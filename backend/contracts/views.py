from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import Role
from users.permissions import HasRolePermission, can

from .models import (
    Anticipo,
    AvanceDiario,
    Bitacora,
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Convenio,
    Estimacion,
    Garantia,
    Incumplimiento,
    Minuta,
    OrdenPago,
    Persona,
    ProgramaObra,
    SolicitudActivacion,
    calcular_desglose_estimacion,
    construir_firmas,
)
from .serializers import (
    AnticipoSerializer,
    AvanceDiarioSerializer,
    BitacoraNoteCreateSerializer,
    BitacoraNoteFotoSerializer,
    BitacoraNoteSerializer,
    BitacoraSerializer,
    ConceptoCatalogoSerializer,
    ConceptoProgramaSerializer,
    ContractDocumentSerializer,
    ContractSerializer,
    ContratistaSerializer,
    ConvenioConceptoAfectadoSerializer,
    ConvenioConceptoNuevoSerializer,
    ConvenioSerializer,
    EstimacionSerializer,
    GarantiaSerializer,
    IncumplimientoSerializer,
    MinutaSerializer,
    OrdenPagoSerializer,
    PersonaSerializer,
    ProgramaObraSerializer,
)

# Roles que solo deben ver los contratos donde están asignados como
# residente/supervisor/superintendente (y, por extensión, las estimaciones,
# convenios, etc. de esos contratos). dependencia y finanzas son roles de
# control transversal y ven todo.
ROLES_VISIBILIDAD_RESTRINGIDA = {Role.RESIDENTE, Role.SUPERVISION, Role.SUPERINTENDENTE}


def contratos_visibles_para(user):
    qs = Contract.objects.all()
    if user.role in ROLES_VISIBILIDAD_RESTRINGIDA:
        if not user.persona_id:
            return qs.none()
        qs = qs.filter(
            Q(residente_id=user.persona_id)
            | Q(supervisor_id=user.persona_id)
            | Q(superintendente_id=user.persona_id)
        )
    return qs


class ContratistaViewSet(viewsets.ModelViewSet):
    queryset = Contratista.objects.all().order_by("nombre")
    serializer_class = ContratistaSerializer
    permission_classes = [IsAuthenticated]


class PersonaViewSet(viewsets.ModelViewSet):
    queryset = Persona.objects.all().order_by("nombre")
    serializer_class = PersonaSerializer
    permission_classes = [IsAuthenticated]


class ContractViewSet(viewsets.ModelViewSet):
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "create": "contrato.crear",
        "solicitar_activacion": "contrato.activar",
        "revisar_activacion": "contrato.revisar-activacion",
        "abrir_bitacora": "bitacora.abrir",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        return contratos_visibles_para(self.request.user).select_related(
            "contratista",
            "residente",
            "supervisor",
            "superintendente",
            "solicitud_activacion",
            "bitacora",
            "anticipo",
            "programa_obra",
        ).prefetch_related(
            "documentos",
            "catalogo_conceptos",
            "versiones",
            "bitacora__notas",
            "estimaciones__orden_pago",
            "garantias",
            "convenios__documentos",
            "avances",
            "incumplimientos",
            "minutas",
        )

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="documentos",
        parser_classes=[MultiPartParser, FormParser],
    )
    def documentos(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "POST":
            serializer = ContractDocumentSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            serializer.save(contrato=contrato, subido_por=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        docs = ContractDocumentSerializer(
            contrato.documentos.all(), many=True, context=self.get_serializer_context()
        )
        return Response(docs.data)

    @action(detail=True, methods=["get", "put"], url_path="catalogo")
    def catalogo(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "PUT":
            serializer = ConceptoCatalogoSerializer(data=request.data, many=True)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                contrato.catalogo_conceptos.all().delete()
                for item in serializer.validated_data:
                    ConceptoCatalogo.objects.create(contrato=contrato, **item)
        return Response(ConceptoCatalogoSerializer(contrato.catalogo_conceptos.all(), many=True).data)

    @action(detail=True, methods=["get", "put"], url_path="programa-obra")
    def programa_obra(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "PUT":
            item_serializer = ConceptoProgramaSerializer(data=request.data, many=True)
            item_serializer.is_valid(raise_exception=True)

            conceptos_ids = {item["concepto_id"] for item in item_serializer.validated_data}
            existentes = set(contrato.catalogo_conceptos.filter(pk__in=conceptos_ids).values_list("id", flat=True))
            faltantes = conceptos_ids - existentes
            if faltantes:
                raise ValidationError(
                    {"conceptos": f"Estos conceptos no pertenecen al contrato: {sorted(faltantes)}"}
                )

            ProgramaObra.objects.update_or_create(contrato=contrato, defaults={"conceptos": request.data})

        programa = getattr(contrato, "programa_obra", None)
        if programa is None:
            return Response({"conceptos": [], "updated_at": None})
        return Response(ProgramaObraSerializer(programa).data)

    @action(detail=True, methods=["post"], url_path="solicitar-activacion")
    def solicitar_activacion(self, request, pk=None):
        contrato = self.get_object()
        SolicitudActivacion.objects.update_or_create(
            contrato=contrato,
            defaults={
                "status": SolicitudActivacion.Status.PENDIENTE,
                "solicitado_por": request.user,
                "fecha_solicitud": date.today(),
                "revisado_por": None,
                "fecha_revision": None,
                "observaciones": "",
            },
        )
        return Response(ContractSerializer(contrato).data)

    @action(detail=True, methods=["post"], url_path="revisar-activacion")
    def revisar_activacion(self, request, pk=None):
        contrato = self.get_object()
        solicitud = getattr(contrato, "solicitud_activacion", None)
        if solicitud is None:
            return Response({"detail": "No hay solicitud de activación."}, status=status.HTTP_400_BAD_REQUEST)

        aprobado = bool(request.data.get("aprobado"))
        hoy = date.today()

        solicitud.status = (
            SolicitudActivacion.Status.APROBADA if aprobado else SolicitudActivacion.Status.RECHAZADA
        )
        solicitud.revisado_por = request.user
        solicitud.fecha_revision = hoy
        solicitud.observaciones = request.data.get("observaciones", "")
        solicitud.save()

        if aprobado:
            contrato.status = Contract.Status.ACTIVO
            contrato.fecha_activacion = hoy
            contrato.save(update_fields=["status", "fecha_activacion"])
            Bitacora.objects.get_or_create(
                contrato=contrato,
                defaults={
                    "abierta": True,
                    "fecha_apertura": hoy,
                    "nota_apertura": (
                        f"Bitácora abierta automáticamente al activar el contrato el {hoy}. "
                        f"Revisado y aprobado por {request.user.get_full_name()}."
                    ),
                },
            )

        return Response(ContractSerializer(contrato).data)

    @action(detail=True, methods=["get"], url_path="bitacora")
    def bitacora(self, request, pk=None):
        contrato = self.get_object()
        bitacora = getattr(contrato, "bitacora", None)
        if bitacora is None:
            return Response({"abierta": False, "fecha_apertura": None, "nota_apertura": "", "notas": []})
        return Response(BitacoraSerializer(bitacora, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="bitacora/abrir")
    def abrir_bitacora(self, request, pk=None):
        contrato = self.get_object()
        bitacora, _ = Bitacora.objects.update_or_create(
            contrato=contrato,
            defaults={
                "abierta": True,
                "fecha_apertura": date.today(),
                "nota_apertura": request.data.get("nota_apertura", ""),
            },
        )
        return Response(BitacoraSerializer(bitacora).data)

    @action(detail=True, methods=["get", "post"], url_path="bitacora/notas")
    def bitacora_notas(self, request, pk=None):
        contrato = self.get_object()
        bitacora = getattr(contrato, "bitacora", None)

        if request.method == "POST":
            if not can(request.user.role, "bitacora.notear"):
                raise PermissionDenied("No tienes permiso para agregar notas a la bitácora.")
            if bitacora is None or not bitacora.abierta:
                return Response({"detail": "La bitácora no está abierta."}, status=status.HTTP_400_BAD_REQUEST)

            serializer = BitacoraNoteCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            fotos_validadas = []
            for imagen in request.FILES.getlist("fotos"):
                foto_serializer = BitacoraNoteFotoSerializer(data={"imagen": imagen})
                foto_serializer.is_valid(raise_exception=True)
                fotos_validadas.append(foto_serializer.validated_data["imagen"])

            nota = bitacora.notas.create(
                numero=bitacora.notas.count() + 1,
                autor=request.user,
                rol=request.user.role,
                fecha=date.today(),
                firmas=construir_firmas(contrato, request.user),
                **serializer.validated_data,
            )
            for imagen in fotos_validadas:
                nota.fotos.create(imagen=imagen)
            return Response(
                BitacoraNoteSerializer(nota, context=self.get_serializer_context()).data,
                status=status.HTTP_201_CREATED,
            )

        notas = bitacora.notas.all() if bitacora else []
        return Response(BitacoraNoteSerializer(notas, many=True, context=self.get_serializer_context()).data)


class EstimacionViewSet(viewsets.ModelViewSet):
    serializer_class = EstimacionSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "create": "estimacion.crear",
        "revisar": "estimacion.revisar",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Estimacion.objects.filter(contrato__in=contratos).select_related(
            "contrato", "creada_por", "orden_pago"
        )

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        numero = Estimacion.objects.filter(contrato=contrato).count() + 1
        anticipo = getattr(contrato, "anticipo", None)
        desglose = calcular_desglose_estimacion(serializer.validated_data["importe_bruto"], anticipo=anticipo)
        serializer.save(numero=numero, creada_por=self.request.user, **desglose)

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        estimacion = self.get_object()
        nuevo_status = request.data.get("status")
        if nuevo_status not in (Estimacion.Status.ACEPTADA, Estimacion.Status.RECHAZADA):
            return Response(
                {"detail": "status debe ser 'aceptada' o 'rechazada'."}, status=status.HTTP_400_BAD_REQUEST
            )

        estimacion.status = nuevo_status
        estimacion.observaciones = request.data.get("observaciones", "")
        estimacion.save(update_fields=["status", "observaciones"])

        if nuevo_status == Estimacion.Status.ACEPTADA:
            OrdenPago.objects.get_or_create(
                estimacion=estimacion,
                defaults={"contrato": estimacion.contrato, "monto": estimacion.importe_neto},
            )
            anticipo = getattr(estimacion.contrato, "anticipo", None)
            if anticipo is not None:
                anticipo.saldo_pendiente = max(
                    Decimal("0"), anticipo.saldo_pendiente - estimacion.amortizacion_anticipo
                )
                anticipo.save(update_fields=["saldo_pendiente"])

        return Response(EstimacionSerializer(estimacion, context=self.get_serializer_context()).data)


class OrdenPagoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrdenPagoSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "dispersar": "pago.dispersar",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return OrdenPago.objects.filter(contrato__in=contratos).select_related("contrato", "estimacion")

    @action(detail=True, methods=["post"])
    def dispersar(self, request, pk=None):
        orden = self.get_object()
        orden.status = OrdenPago.Status.ATENDIDA
        orden.fecha_atencion = date.today()
        orden.save(update_fields=["status", "fecha_atencion"])
        return Response(OrdenPagoSerializer(orden, context=self.get_serializer_context()).data)


class GarantiaViewSet(viewsets.ModelViewSet):
    serializer_class = GarantiaSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "create": "garantia.registrar",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Garantia.objects.filter(contrato__in=contratos).select_related("contrato", "documento")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        tipo = serializer.validated_data["tipo"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        if Garantia.objects.filter(contrato=contrato, tipo=tipo).exists():
            raise ValidationError({"tipo": "Ya existe una garantía de este tipo para el contrato."})

        archivo = serializer.validated_data.pop("archivo", None)
        documento = None
        if archivo:
            documento = ContractDocument.objects.create(
                contrato=contrato,
                bloque=ContractDocument.Bloque.GARANTIA,
                nombre=archivo.name,
                archivo=archivo,
                fecha=date.today(),
                subido_por=self.request.user,
            )
        serializer.save(registrado_por=self.request.user, documento=documento)

    @action(detail=True, methods=["post"])
    def liberar(self, request, pk=None):
        garantia = self.get_object()
        garantia.liberada_por = request.user
        garantia.fecha_liberacion = date.today()
        garantia.save(update_fields=["liberada_por", "fecha_liberacion"])
        return Response(GarantiaSerializer(garantia, context=self.get_serializer_context()).data)


class AnticipoViewSet(viewsets.ModelViewSet):
    serializer_class = AnticipoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Anticipo.objects.filter(contrato__in=contratos).select_related("contrato", "garantia")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        if Anticipo.objects.filter(contrato=contrato).exists():
            raise ValidationError({"contrato_id": "Este contrato ya tiene un anticipo registrado."})
        serializer.save()


class ConvenioViewSet(viewsets.ModelViewSet):
    serializer_class = ConvenioSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "create": "convenio.crear",
        "revisar": "convenio.revisar",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Convenio.objects.filter(contrato__in=contratos).select_related("contrato", "solicitado_por")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")

        alcance = serializer.validated_data.get("alcance")
        conceptos_afectados = serializer.validated_data.get("conceptos_afectados")
        conceptos_nuevos = serializer.validated_data.get("conceptos_nuevos")

        if alcance == Convenio.Alcance.AJUSTE_CANTIDADES:
            if not conceptos_afectados:
                raise ValidationError({"conceptos_afectados": "Requerido para este alcance."})
            for item in conceptos_afectados:
                item_serializer = ConvenioConceptoAfectadoSerializer(data=item)
                item_serializer.is_valid(raise_exception=True)
                if not contrato.catalogo_conceptos.filter(pk=item_serializer.validated_data["concepto_id"]).exists():
                    raise ValidationError(
                        {"conceptos_afectados": f"El concepto {item.get('concepto_id')} no pertenece a este contrato."}
                    )

        if alcance == Convenio.Alcance.CONCEPTOS_NUEVOS:
            if not conceptos_nuevos:
                raise ValidationError({"conceptos_nuevos": "Requerido para este alcance."})
            for item in conceptos_nuevos:
                item_serializer = ConvenioConceptoNuevoSerializer(data=item)
                item_serializer.is_valid(raise_exception=True)

        convenio = serializer.save(solicitado_por=self.request.user)
        for archivo in self.request.FILES.getlist("documentos"):
            convenio.documentos.create(archivo=archivo, nombre=archivo.name, subido_por=self.request.user)

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        convenio = self.get_object()
        nuevo_status = request.data.get("status")
        if nuevo_status not in (Convenio.Status.APROBADO, Convenio.Status.RECHAZADO):
            return Response(
                {"detail": "status debe ser 'aprobado' o 'rechazado'."}, status=status.HTTP_400_BAD_REQUEST
            )

        if nuevo_status == Convenio.Status.APROBADO:
            self._aplicar_convenio(convenio)

        convenio.status = nuevo_status
        convenio.motivo_rechazo = request.data.get("motivo_rechazo", "")
        convenio.save(update_fields=["status", "motivo_rechazo"])
        return Response(ConvenioSerializer(convenio, context=self.get_serializer_context()).data)

    def _aplicar_convenio(self, convenio):
        contrato = convenio.contrato
        catalogo_actualizado = False

        if convenio.alcance == Convenio.Alcance.AJUSTE_CANTIDADES and convenio.conceptos_afectados:
            for ajuste in convenio.conceptos_afectados:
                concepto = contrato.catalogo_conceptos.filter(pk=ajuste["concepto_id"]).first()
                if concepto:
                    concepto.cantidad = ajuste["cantidad_nueva"]
                    concepto.save()
            catalogo_actualizado = True

        if convenio.alcance == Convenio.Alcance.CONCEPTOS_NUEVOS and convenio.conceptos_nuevos:
            for nuevo in convenio.conceptos_nuevos:
                ConceptoCatalogo.objects.create(contrato=contrato, **nuevo)
            catalogo_actualizado = True

        contrato.monto = contrato.monto + convenio.monto_adicional
        if convenio.tipo != Convenio.Tipo.MONTO and convenio.dias_adicionales:
            contrato.fecha_termino = contrato.fecha_termino + timedelta(days=convenio.dias_adicionales)
        contrato.plazo_dias = contrato.plazo_dias + convenio.dias_adicionales
        contrato.version = contrato.version + 1
        contrato.save(update_fields=["monto", "fecha_termino", "plazo_dias", "version"])

        snapshot = None
        if catalogo_actualizado:
            snapshot = ConceptoCatalogoSerializer(contrato.catalogo_conceptos.all(), many=True).data

        ContractVersion.objects.create(
            contrato=contrato,
            version=contrato.version,
            fecha=date.today(),
            monto=contrato.monto,
            fecha_termino=contrato.fecha_termino,
            motivo=f"Convenio modificatorio: {convenio.get_tipo_display()}",
            catalogo_snapshot=snapshot,
        )


class AvanceDiarioViewSet(viewsets.ModelViewSet):
    serializer_class = AvanceDiarioSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]
    ACTION_PERMISSIONS = {"create": "avance.registrar"}

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return AvanceDiario.objects.filter(contrato__in=contratos).select_related("contrato", "autor")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        serializer.save(autor=self.request.user)


class IncumplimientoViewSet(viewsets.ModelViewSet):
    serializer_class = IncumplimientoSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]
    ACTION_PERMISSIONS = {"create": "incumplimiento.registrar"}

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Incumplimiento.objects.filter(contrato__in=contratos).select_related("contrato", "autor")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        serializer.save(autor=self.request.user)


class MinutaViewSet(viewsets.ModelViewSet):
    serializer_class = MinutaSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]
    ACTION_PERMISSIONS = {"create": "minuta.registrar"}

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return Minuta.objects.filter(contrato__in=contratos).select_related("contrato", "autor")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        serializer.save(autor=self.request.user)

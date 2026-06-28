from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import Role
from users.permissions import HasRolePermission, PERMISOS_POR_TIPO_NOTA, can

from .models import (
    Anticipo,
    AvanceDiario,
    BitacoraNote,
    Bitacora,
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Convenio,
    EmpresaSupervision,
    Estimacion,
    Garantia,
    Incumplimiento,
    LineaEstimacion,
    Minuta,
    OrdenPago,
    Persona,
    ProgramaObra,
    SolicitudActivacion,
    calcular_acumulado_convenios,
    calcular_avance_programado_contrato,
    calcular_avance_real_contrato,
    calcular_desglose_estimacion,
    calcular_mes_de_semana,
    construir_firmas,
    UMBRAL_ATRASO_PP,
    validar_convenio_pendiente_unico,
    validar_garantias_para_activacion,
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
    EmpresaSupervisionSerializer,
    EstimacionSerializer,
    GarantiaSerializer,
    IncumplimientoSerializer,
    LineaEstimacionInputSerializer,
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
    queryset = Contratista.objects.prefetch_related("superintendentes").order_by("nombre")
    serializer_class = ContratistaSerializer
    permission_classes = [IsAuthenticated]


class EmpresaSupervisionViewSet(viewsets.ModelViewSet):
    queryset = EmpresaSupervision.objects.prefetch_related("supervisores").order_by("nombre")
    serializer_class = EmpresaSupervisionSerializer
    permission_classes = [IsAuthenticated]


class PersonaViewSet(viewsets.ModelViewSet):
    serializer_class = PersonaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Persona.objects.all().order_by("nombre")
        empresa_contratista = self.request.query_params.get("empresa_contratista")
        empresa_supervision = self.request.query_params.get("empresa_supervision")
        sin_empresa = self.request.query_params.get("sin_empresa")

        if empresa_contratista:
            qs = qs.filter(empresa_contratista_id=empresa_contratista)
        if empresa_supervision:
            qs = qs.filter(empresa_supervision_id=empresa_supervision)
        if sin_empresa == "true":
            qs = qs.filter(empresa_contratista__isnull=True, empresa_supervision__isnull=True)
        return qs


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
            "contratista__superintendentes",
            "documentos",
            "catalogo_conceptos",
            "versiones",
            "bitacora__notas__conceptos",
            "estimaciones__orden_pago",
            "estimaciones__lineas__concepto",
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
            serializer.save(contrato=contrato, subido_por=request.user, fecha=date.today())
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        docs = ContractDocumentSerializer(
            contrato.documentos.all(), many=True, context=self.get_serializer_context()
        )
        return Response(docs.data)

    @action(detail=True, methods=["get", "put"], url_path="catalogo")
    def catalogo(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "PUT":
            if contrato.status == Contract.Status.ACTIVO:
                raise ValidationError(
                    "No se puede editar el catálogo de un contrato activo. "
                    "Use el flujo de convenio modificatorio."
                )
            serializer = ConceptoCatalogoSerializer(data=request.data, many=True)
            serializer.is_valid(raise_exception=True)
            with transaction.atomic():
                contrato.catalogo_conceptos.all().delete()
                for item in serializer.validated_data:
                    ConceptoCatalogo.objects.create(contrato=contrato, **item)
        return Response(ConceptoCatalogoSerializer(contrato.catalogo_conceptos.all(), many=True).data)

    @action(detail=True, methods=["get"], url_path="avance-conceptos")
    def avance_conceptos(self, request, pk=None):
        contrato = self.get_object()
        conceptos = list(contrato.catalogo_conceptos.all())
        acumulados = dict(
            LineaEstimacion.objects.filter(
                concepto__contrato=contrato,
                estimacion__status=Estimacion.Status.ACEPTADA,
            )
            .values("concepto_id")
            .annotate(total=Sum("cantidad_ejecutada"))
            .values_list("concepto_id", "total")
        )
        resultado = []
        for c in conceptos:
            acumulada = acumulados.get(c.id, Decimal("0"))
            pct = round(float(acumulada / c.cantidad * 100), 1) if c.cantidad else 0
            resultado.append({
                "concepto_id": c.id,
                "clave": c.clave,
                "descripcion": c.descripcion,
                "unidad": c.unidad,
                "cantidad_contratada": float(c.cantidad),
                "cantidad_acumulada": float(acumulada),
                "porcentaje_avance": pct,
            })
        return Response(resultado)

    @action(detail=True, methods=["get", "put"], url_path="programa-obra")
    def programa_obra(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "PUT":
            item_serializer = ConceptoProgramaSerializer(data=request.data, many=True)
            item_serializer.is_valid(raise_exception=True)

            conceptos_ids = {item["concepto_id"] for item in item_serializer.validated_data}
            conceptos_db = {
                c.id: c for c in contrato.catalogo_conceptos.filter(pk__in=conceptos_ids)
            }
            faltantes = conceptos_ids - set(conceptos_db.keys())
            if faltantes:
                raise ValidationError(
                    {"conceptos": f"Estos conceptos no pertenecen al contrato: {sorted(faltantes)}"}
                )

            # Validar que la cantidad programada no supere la contratada por concepto.
            # concepto.cantidad ya refleja ajustes de convenios modificatorios aprobados.
            errores = []
            for item in item_serializer.validated_data:
                concepto = conceptos_db.get(item["concepto_id"])
                if not concepto:
                    continue
                total_programado = sum(float(m["cantidad"]) for m in item["meses"])
                if total_programado > float(concepto.cantidad):
                    errores.append(
                        f"{concepto.clave}: programado {total_programado} > contratado {float(concepto.cantidad)}"
                    )
            if errores:
                raise ValidationError({"cantidades": errores})

            ProgramaObra.objects.update_or_create(contrato=contrato, defaults={"conceptos": request.data})

        programa = getattr(contrato, "programa_obra", None)
        if programa is None:
            return Response({"conceptos": [], "updated_at": None})
        return Response(ProgramaObraSerializer(programa).data)

    @action(detail=True, methods=["get"], url_path="calendario-mensual")
    def calendario_mensual(self, request, pk=None):
        """Retorna ConceptoMes[] cruzando ProgramaObra (programado) con
        LineaEstimacion de estimaciones ACEPTADAS (ejecutado), por mes de obra."""
        contrato = self.get_object()
        conceptos = list(contrato.catalogo_conceptos.all())

        # ── Programado: leer ProgramaObra JSONField (estructura mensual) ──────
        programa = getattr(contrato, "programa_obra", None)
        # programado[concepto_id][mes] = cantidad_programada
        programado: dict[int, dict[int, float]] = {}
        total_meses = 1
        if programa:
            for cp in programa.conceptos:
                cid = int(cp["concepto_id"])
                programado.setdefault(cid, {})
                for mm in cp.get("meses", []):
                    mes = int(mm["mes"])
                    total_meses = max(total_meses, mes)
                    programado[cid][mes] = programado[cid].get(mes, 0) + float(mm["cantidad"])

        # Calcular total de meses del contrato (ceil de días / 30)
        if contrato.fecha_inicio and contrato.fecha_termino:
            diff_dias = (contrato.fecha_termino - contrato.fecha_inicio).days
            total_meses_contrato = max(1, -(-diff_dias // 30))  # ceil
            total_meses = max(total_meses, total_meses_contrato)

        # ── Ejecutado: LineaEstimacion de estimaciones ACEPTADAS ─────────────
        lineas_aceptadas = (
            LineaEstimacion.objects.filter(
                concepto__contrato=contrato,
                estimacion__status=Estimacion.Status.ACEPTADA,
            )
            .select_related("estimacion", "concepto")
        )

        # ejecutado[concepto_id][mes] = cantidad_ejecutada
        ejecutado: dict[int, dict[int, float]] = {}
        for linea in lineas_aceptadas:
            cid = linea.concepto_id
            ejecutado.setdefault(cid, {})
            periodo_inicio = linea.estimacion.periodo_inicio
            if contrato.fecha_inicio:
                diff_dias = (periodo_inicio - contrato.fecha_inicio).days
                mes_est = max(1, -(-diff_dias // 30)) if diff_dias >= 0 else 1
            else:
                mes_est = 1
            total_meses = max(total_meses, mes_est)
            ejecutado[cid][mes_est] = ejecutado[cid].get(mes_est, 0) + float(linea.cantidad_ejecutada)

        # ── Construcción de respuesta ─────────────────────────────────────────
        meses = list(range(1, total_meses + 1))
        resultado = []
        for c in conceptos:
            cid = c.id
            prog_concepto = programado.get(cid, {})
            ejec_concepto = ejecutado.get(cid, {})
            meses_data = []
            acumulada = 0.0
            for mes in meses:
                cant_prog = prog_concepto.get(mes, 0)
                cant_ejec = ejec_concepto.get(mes, 0)
                acumulada += cant_ejec
                meses_data.append({
                    "mes": mes,
                    "cantidad_programada": cant_prog,
                    "cantidad_ejecutada": cant_ejec,
                    "cantidad_acumulada": round(acumulada, 4),
                    "terminado_este_mes": (
                        acumulada >= float(c.cantidad) and cant_ejec > 0 and float(c.cantidad) > 0
                    ),
                })
            resultado.append({
                "concepto_id": cid,
                "clave": c.clave,
                "descripcion": c.descripcion,
                "unidad": c.unidad,
                "cantidad_contratada": float(c.cantidad),
                "meses": meses_data,
            })

        # Calcular rango de fechas de cada mes de obra
        rangos_meses = []
        for mes in meses:
            if contrato.fecha_inicio:
                inicio_mes = contrato.fecha_inicio + timedelta(weeks=(mes - 1) * 4)
                fin_mes = inicio_mes + timedelta(weeks=4) - timedelta(days=1)
            else:
                inicio_mes = fin_mes = None
            rangos_meses.append({
                "mes": mes,
                "fecha_inicio": inicio_mes.isoformat() if inicio_mes else None,
                "fecha_fin": fin_mes.isoformat() if fin_mes else None,
            })

        return Response({
            "meses": rangos_meses,
            "conceptos": resultado,
        })

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
            faltantes = validar_garantias_para_activacion(contrato)
            if faltantes:
                raise ValidationError({
                    "garantias": (
                        f"No se puede activar el contrato. Faltan garantías vigentes: "
                        f"{', '.join(faltantes)}."
                    )
                })
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
            tipo_solicitado = request.data.get("tipo")
            roles_para_tipo = PERMISOS_POR_TIPO_NOTA.get(tipo_solicitado)
            if roles_para_tipo is not None:
                if request.user.role not in roles_para_tipo:
                    raise PermissionDenied(
                        f"Solo el rol '{', '.join(roles_para_tipo)}' puede registrar "
                        f"notas de tipo '{tipo_solicitado}'."
                    )
            elif not can(request.user.role, "bitacora.notear"):
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

            validated = dict(serializer.validated_data)
            conceptos_m2m = validated.pop("conceptos", [])
            nota_padre = validated.pop("nota_padre", None)

            nota = bitacora.notas.create(
                numero=bitacora.notas.count() + 1,
                autor=request.user,
                rol=request.user.role,
                fecha=date.today(),
                firmas=construir_firmas(contrato, request.user),
                nota_padre=nota_padre,
                **validated,
            )
            if conceptos_m2m:
                nota.conceptos.set(conceptos_m2m)
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
        ).prefetch_related("lineas__concepto")

    def perform_create(self, serializer):
        contrato = serializer.validated_data["contrato"]
        if not contratos_visibles_para(self.request.user).filter(pk=contrato.pk).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")

        lineas_data = self.request.data.get("lineas", [])
        lineas_validadas = []
        for item in lineas_data:
            ls = LineaEstimacionInputSerializer(data=item)
            ls.is_valid(raise_exception=True)
            concepto = ls.validated_data["concepto"]
            if concepto.contrato_id != contrato.pk:
                raise ValidationError(
                    {"lineas": f"El concepto {concepto.clave} no pertenece a este contrato."}
                )
            lineas_validadas.append(ls.validated_data)

        numero = Estimacion.objects.filter(contrato=contrato).count() + 1
        anticipo = getattr(contrato, "anticipo", None)
        desglose = calcular_desglose_estimacion(serializer.validated_data["importe_bruto"], anticipo=anticipo)

        with transaction.atomic():
            estimacion = serializer.save(numero=numero, creada_por=self.request.user, **desglose)

            acumulados_previos = {}
            errores_cap = []
            for item in lineas_validadas:
                concepto = item["concepto"]
                acumulado_previo = (
                    LineaEstimacion.objects.filter(
                        concepto=concepto,
                        estimacion__status=Estimacion.Status.ACEPTADA,
                    ).aggregate(total=Sum("cantidad_ejecutada"))["total"]
                    or Decimal("0")
                )
                acumulados_previos[concepto.id] = acumulado_previo
                propuesto = acumulado_previo + item["cantidad_ejecutada"]
                if propuesto > concepto.cantidad:
                    errores_cap.append(
                        f"{concepto.clave}: acumulado propuesto {propuesto} "
                        f"excede la cantidad contratada {concepto.cantidad}."
                    )

            if errores_cap:
                raise ValidationError({"lineas": errores_cap})

            for item in lineas_validadas:
                concepto = item["concepto"]
                LineaEstimacion.objects.create(
                    estimacion=estimacion,
                    concepto=concepto,
                    cantidad_ejecutada=item["cantidad_ejecutada"],
                    cantidad_acumulada=acumulados_previos[concepto.id] + item["cantidad_ejecutada"],
                    generador_detalle=item.get("generador_detalle", ""),
                )

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        estimacion = self.get_object()
        if estimacion.creada_por_id == request.user.id:
            raise ValidationError("Quien registra una estimación no puede ser quien la revisa.")
        nuevo_status = request.data.get("status")
        if nuevo_status not in (Estimacion.Status.ACEPTADA, Estimacion.Status.RECHAZADA):
            return Response(
                {"detail": "status debe ser 'aceptada' o 'rechazada'."}, status=status.HTTP_400_BAD_REQUEST
            )

        estimacion.status = nuevo_status
        estimacion.observaciones = request.data.get("observaciones", "")
        estimacion.save(update_fields=["status", "observaciones"])

        advertencia = None
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

            # Recalcular y persistir avances en el contrato
            avance_real = calcular_avance_real_contrato(estimacion.contrato)
            avance_prog = calcular_avance_programado_contrato(estimacion.contrato)
            campos_actualizar = ["avance_real"]
            estimacion.contrato.avance_real = min(100, round(avance_real))
            if avance_prog is not None:
                estimacion.contrato.avance_programado = min(100, round(avance_prog))
                campos_actualizar.append("avance_programado")
            estimacion.contrato.save(update_fields=campos_actualizar)

            # Alerta de atraso automática
            if avance_prog is not None:
                diferencia = avance_prog - avance_real
                if diferencia >= UMBRAL_ATRASO_PP:
                    ref_est = f"Est. #{estimacion.numero}"
                    ya_existe = Incumplimiento.objects.filter(
                        contrato=estimacion.contrato,
                        tipo=Incumplimiento.Tipo.ATRASO,
                        evidencia_ref=ref_est,
                    ).exists()
                    if not ya_existe:
                        Incumplimiento.objects.create(
                            contrato=estimacion.contrato,
                            tipo=Incumplimiento.Tipo.ATRASO,
                            descripcion=(
                                f"Atraso detectado al aceptar la estimación #{estimacion.numero}. "
                                f"Avance programado: {avance_prog:.1f}% — real: {avance_real:.1f}% "
                                f"(desfase: {diferencia:.1f} p.p.)."
                            ),
                            evidencia_ref=ref_est,
                            autor=request.user,
                        )
                    advertencia = (
                        f"Atraso de {diferencia:.1f}% detectado: "
                        f"programado {avance_prog:.1f}% vs real {avance_real:.1f}%. "
                        "Se generó un incumplimiento automático de tipo Atraso."
                    )

            # Advertencia si no hay avances diarios en el periodo
            if advertencia is None:
                tiene_avances = AvanceDiario.objects.filter(
                    contrato=estimacion.contrato,
                    fecha__range=[estimacion.periodo_inicio, estimacion.periodo_fin],
                ).exists()
                if not tiene_avances:
                    advertencia = (
                        "Esta estimación fue aceptada sin registros de avance diario en su periodo "
                        f"({estimacion.periodo_inicio} – {estimacion.periodo_fin}). "
                        "Se recomienda registrar los avances correspondientes."
                    )

        data = EstimacionSerializer(estimacion, context=self.get_serializer_context()).data
        if advertencia:
            data["advertencia_avance"] = advertencia
        return Response(data)


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

        try:
            validar_convenio_pendiente_unico(contrato)
        except Exception as e:
            raise ValidationError({"contrato_id": str(e)})

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

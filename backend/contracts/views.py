from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.conf import settings
from django.contrib.auth import get_user_model
from users.models import Role
from users.permissions import HasRolePermission, PERMISOS_POR_TIPO_NOTA, can

from .models import (
    ActaEntregaRecepcion,
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
    Finiquito,
    Garantia,
    Incumplimiento,
    LineaEstimacion,
    Minuta,
    OrdenPago,
    Persona,
    ProgramaObra,
    ReporteAvanceConcepto,
    SolicitudActivacion,
    TerminacionContrato,
    calcular_acumulado_convenios,
    calcular_avance_programado_contrato,
    calcular_avance_real_contrato,
    calcular_desglose_estimacion,
    calcular_mes_de_semana,
    construir_firmas,
    evaluar_terminacion_concepto,
    UMBRAL_ATRASO_PP,
    validar_convenio_pendiente_unico,
    validar_garantias_para_activacion,
    validar_tope_convenio,
)
from .serializers import (
    ActaEntregaRecepcionSerializer,
    AnticipoSerializer,
    AvanceDiarioSerializer,
    BitacoraNoteCreateSerializer,
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
    FiniquitoSerializer,
    GarantiaSerializer,
    IncumplimientoSerializer,
    LineaEstimacionInputSerializer,
    MinutaSerializer,
    OrdenPagoSerializer,
    PersonaSerializer,
    ProgramaObraSerializer,
    ReporteAvanceConceptoSerializer,
    TerminacionContratoSerializer,
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


DEFAULT_USER_PASSWORD = settings.DEFAULT_USER_PASSWORD


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

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        persona_id = response.data.get("id")
        try:
            persona = Persona.objects.get(id=persona_id)
        except Persona.DoesNotExist:
            return response

        if not persona.correo:
            response.data["usuario_creado"] = False
            return response

        # Determine role from empresa relationship
        if persona.empresa_contratista_id:
            role = Role.SUPERINTENDENTE
        elif persona.empresa_supervision_id:
            role = Role.SUPERVISION
        else:
            role = Role.RESIDENTE

        # Derive initials (up to 2 words)
        parts = persona.nombre.split()
        initials = "".join(p[0].upper() for p in parts[:2])
        first_name, *rest = parts[0], parts[1:]
        last_name = " ".join(rest[0]) if rest else ""

        UserModel = get_user_model()
        user, created = UserModel.objects.get_or_create(
            email=persona.correo,
            defaults={
                "username": persona.correo,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "initials": initials,
                "persona": persona,
            },
        )
        if created:
            user.set_password(DEFAULT_USER_PASSWORD)
            user.save()
        elif user.persona_id is None:
            user.persona = persona
            user.save(update_fields=["persona"])

        response.data["usuario_creado"] = created
        return response


class ContractViewSet(viewsets.ModelViewSet):
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]

    ACTION_PERMISSIONS = {
        "create": "contrato.crear",
        "solicitar_activacion": "contrato.activar",
        "revisar_activacion": "contrato.revisar-activacion",
        "abrir_bitacora": "bitacora.abrir",
        "terminar": "cierre.terminar",
        "cargar_acta": "cierre.cargar-acta",
        "emit_finiquito": "finiquito.emitir",
        "notificar_finiquito": "finiquito.notificar",
        "responder_finiquito": "finiquito.responder",
        "cerrar_finiquito": "finiquito.cerrar",
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
            "terminacion",
            "terminacion__acta",
            "finiquito",
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
            return Response(
                BitacoraNoteSerializer(nota, context=self.get_serializer_context()).data,
                status=status.HTTP_201_CREATED,
            )

        notas = bitacora.notas.all() if bitacora else []
        return Response(BitacoraNoteSerializer(notas, many=True, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="terminar")
    def terminar(self, request, pk=None):
        contrato = self.get_object()

        if contrato.status != Contract.Status.ACTIVO:
            raise ValidationError("Solo se puede registrar la terminación de un contrato activo.")
        if hasattr(contrato, "terminacion"):
            raise ValidationError("Ya existe un registro de terminación para este contrato.")
        if contrato.convenios.filter(status=Convenio.Status.PENDIENTE).exists():
            raise ValidationError(
                "No se puede registrar la terminación mientras exista un convenio modificatorio pendiente de revisión."
            )
        if contrato.incumplimientos.filter(resuelto=False).exists():
            raise ValidationError(
                "No se puede registrar la terminación mientras existan incumplimientos formales sin resolver."
            )

        tipo = request.data.get("tipo")
        if tipo not in (
            TerminacionContrato.Tipo.NORMAL,
            TerminacionContrato.Tipo.ANTICIPADA,
            TerminacionContrato.Tipo.SUSPENSION,
        ):
            raise ValidationError({"tipo": "Tipo de terminación inválido."})

        avance_raw = request.data.get("avance_fisico_final")
        if avance_raw is None:
            raise ValidationError({"avance_fisico_final": "El avance físico final es requerido."})
        avance_fisico_final = Decimal(str(avance_raw))

        if tipo == TerminacionContrato.Tipo.NORMAL and avance_fisico_final < 100:
            raise ValidationError(
                "Para terminación de tipo normal, el avance físico final debe ser del 100%."
            )

        nota_cierre = request.data.get("nota_cierre", "").strip()
        if not nota_cierre:
            raise ValidationError({"nota_cierre": "La nota de cierre es requerida."})

        motivo = request.data.get("motivo", "").strip()
        if tipo in (TerminacionContrato.Tipo.ANTICIPADA, TerminacionContrato.Tipo.SUSPENSION) and not motivo:
            raise ValidationError(
                {"motivo": "Para terminación anticipada o suspensión, se requiere capturar el motivo justificado."}
            )

        fecha_terminacion_str = request.data.get("fecha_terminacion", str(date.today()))
        try:
            fecha_terminacion = date.fromisoformat(fecha_terminacion_str)
        except (ValueError, TypeError):
            raise ValidationError({"fecha_terminacion": "Fecha de terminación inválida."})

        TIPO_LABELS = {
            TerminacionContrato.Tipo.NORMAL: "Normal",
            TerminacionContrato.Tipo.ANTICIPADA: "Anticipada",
            TerminacionContrato.Tipo.SUSPENSION: "Suspensión",
        }

        with transaction.atomic():
            TerminacionContrato.objects.create(
                contrato=contrato,
                tipo=tipo,
                fecha_terminacion=fecha_terminacion,
                avance_fisico_final=avance_fisico_final,
                nota_cierre=nota_cierre,
                motivo=motivo,
                registrado_por=request.user,
            )

            bitacora = getattr(contrato, "bitacora", None)
            if bitacora and bitacora.abierta:
                contenido_lineas = [
                    f"NOTA DE CIERRE — Terminación {TIPO_LABELS.get(tipo, tipo)}",
                    f"Fecha de terminación: {fecha_terminacion}",
                    f"Avance físico final: {avance_fisico_final}%",
                    nota_cierre,
                ]
                if motivo:
                    contenido_lineas.append(f"Motivo: {motivo}")
                bitacora.notas.create(
                    numero=bitacora.notas.count() + 1,
                    tipo=BitacoraNote.Tipo.INSTRUCCION,
                    contenido="\n".join(contenido_lineas),
                    autor=request.user,
                    rol=request.user.role,
                    fecha=date.today(),
                    firmas=construir_firmas(contrato, request.user),
                )

            contrato.status = Contract.Status.EN_CIERRE
            contrato.save(update_fields=["status"])

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)

    @action(
        detail=True, methods=["post"], url_path="cargar-acta",
        parser_classes=[MultiPartParser, FormParser],
    )
    def cargar_acta(self, request, pk=None):
        contrato = self.get_object()

        terminacion = getattr(contrato, "terminacion", None)
        if terminacion is None:
            raise ValidationError("Debe registrar la terminación del contrato antes de cargar el acta.")
        if hasattr(terminacion, "acta"):
            raise ValidationError("Ya existe un acta de entrega-recepción para este contrato.")

        fecha_firma_str = request.data.get("fecha_firma")
        if not fecha_firma_str:
            raise ValidationError({"fecha_firma": "La fecha de firma es requerida."})
        try:
            fecha_firma = date.fromisoformat(fecha_firma_str)
        except (ValueError, TypeError):
            raise ValidationError({"fecha_firma": "Fecha inválida."})

        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValidationError({"archivo": "El archivo del acta es requerido."})

        with transaction.atomic():
            ActaEntregaRecepcion.objects.create(
                terminacion=terminacion,
                fecha_firma=fecha_firma,
                archivo=archivo,
                registrado_por=request.user,
            )
            terminacion.cierre_status = TerminacionContrato.CierreStatus.ACTA_ENTREGADA
            terminacion.save(update_fields=["cierre_status"])

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get", "post"], url_path="finiquito")
    def emit_finiquito(self, request, pk=None):
        contrato = self.get_object()

        if request.method == "GET":
            fin = getattr(contrato, "finiquito", None)
            if fin is None:
                return Response(None)
            return Response(FiniquitoSerializer(fin, context=self.get_serializer_context()).data)

        terminacion = getattr(contrato, "terminacion", None)
        if terminacion is None:
            raise ValidationError("Debe registrar la terminación del contrato antes de emitir el finiquito.")
        if not hasattr(terminacion, "acta"):
            raise ValidationError("Debe cargar el acta de entrega-recepción antes de emitir el finiquito.")

        fin = getattr(contrato, "finiquito", None)
        if fin is not None and fin.status != Finiquito.Status.BORRADOR:
            raise ValidationError("El finiquito ya fue notificado y no puede modificarse.")

        anticipo = getattr(contrato, "anticipo", None)
        saldo_anticipo = anticipo.saldo_pendiente if anticipo else Decimal("0")

        def to_decimal(key):
            val = request.data.get(key, 0)
            try:
                return Decimal(str(val))
            except Exception:
                raise ValidationError({key: "Valor numérico inválido."})

        estimaciones_pendientes = to_decimal("estimaciones_pendientes")
        ajuste_precios = to_decimal("ajuste_precios")
        otros_creditos_contratista = to_decimal("otros_creditos_contratista")
        penas_convencionales = to_decimal("penas_convencionales")
        deducibles = to_decimal("deducibles")

        total_contratista = estimaciones_pendientes + ajuste_precios + otros_creditos_contratista
        total_dependencia = saldo_anticipo + penas_convencionales + deducibles
        saldo_neto = total_contratista - total_dependencia

        with transaction.atomic():
            if fin is None:
                Finiquito.objects.create(
                    contrato=contrato,
                    estimaciones_pendientes=estimaciones_pendientes,
                    ajuste_precios=ajuste_precios,
                    otros_creditos_contratista=otros_creditos_contratista,
                    saldo_anticipo_no_amortizado=saldo_anticipo,
                    penas_convencionales=penas_convencionales,
                    deducibles=deducibles,
                    total_creditos_contratista=total_contratista,
                    total_creditos_dependencia=total_dependencia,
                    saldo_neto=saldo_neto,
                    emitido_por=request.user,
                )
                terminacion.cierre_status = TerminacionContrato.CierreStatus.FINIQUITO_EMITIDO
                terminacion.save(update_fields=["cierre_status"])
            else:
                fin.estimaciones_pendientes = estimaciones_pendientes
                fin.ajuste_precios = ajuste_precios
                fin.otros_creditos_contratista = otros_creditos_contratista
                fin.saldo_anticipo_no_amortizado = saldo_anticipo
                fin.penas_convencionales = penas_convencionales
                fin.deducibles = deducibles
                fin.total_creditos_contratista = total_contratista
                fin.total_creditos_dependencia = total_dependencia
                fin.saldo_neto = saldo_neto
                fin.save()

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="finiquito/notificar")
    def notificar_finiquito(self, request, pk=None):
        contrato = self.get_object()
        fin = getattr(contrato, "finiquito", None)
        if fin is None:
            raise ValidationError("No existe un finiquito para este contrato.")
        if fin.status != Finiquito.Status.BORRADOR:
            raise ValidationError("Solo se puede notificar un finiquito en estado borrador.")

        hoy = date.today()
        fin.status = Finiquito.Status.NOTIFICADO
        fin.fecha_notificacion = hoy
        fin.fecha_limite_respuesta = hoy + timedelta(days=15)
        fin.save(update_fields=["status", "fecha_notificacion", "fecha_limite_respuesta"])

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="finiquito/responder")
    def responder_finiquito(self, request, pk=None):
        contrato = self.get_object()
        fin = getattr(contrato, "finiquito", None)
        if fin is None:
            raise ValidationError("No existe un finiquito para este contrato.")
        if fin.status != Finiquito.Status.NOTIFICADO:
            raise ValidationError("Solo se puede responder un finiquito en estado notificado.")

        conformidad = request.data.get("conformidad")
        if conformidad is None:
            raise ValidationError({"conformidad": "Se requiere indicar la conformidad (true/false)."})
        conformidad = bool(conformidad)

        motivo_inconformidad = request.data.get("motivo_inconformidad", "").strip()
        if not conformidad and not motivo_inconformidad:
            raise ValidationError({"motivo_inconformidad": "Se requiere el motivo de inconformidad."})

        fin.conformidad = conformidad
        fin.motivo_inconformidad = motivo_inconformidad
        fin.status = Finiquito.Status.CONFORME if conformidad else Finiquito.Status.INCONFORMIDAD
        fin.save(update_fields=["conformidad", "motivo_inconformidad", "status"])

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="finiquito/cerrar")
    def cerrar_finiquito(self, request, pk=None):
        contrato = self.get_object()
        fin = getattr(contrato, "finiquito", None)
        if fin is None:
            raise ValidationError("No existe un finiquito para este contrato.")
        if fin.status not in (Finiquito.Status.CONFORME, Finiquito.Status.INCONFORMIDAD):
            raise ValidationError(
                "El contrato solo puede cerrarse si el finiquito está en estado conforme o "
                "con inconformidad registrada."
            )

        with transaction.atomic():
            fin.status = Finiquito.Status.CERRADO
            fin.save(update_fields=["status"])
            contrato.status = Contract.Status.CERRADO
            contrato.save(update_fields=["status"])

        contrato.refresh_from_db()
        return Response(ContractSerializer(contrato, context=self.get_serializer_context()).data)


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

            reportes = ls.validated_data["reporte_ids"]
            for reporte in reportes:
                if reporte.concepto_id != concepto.id:
                    raise ValidationError(
                        {"lineas": f"El reporte #{reporte.id} no corresponde al concepto {concepto.clave}."}
                    )
                if reporte.status != ReporteAvanceConcepto.Status.VALIDADO:
                    raise ValidationError(
                        {"lineas": f"El reporte #{reporte.id} del concepto {concepto.clave} no está validado."}
                    )
                if reporte.usado_en_estimacion_id is not None:
                    raise ValidationError(
                        {"lineas": f"El reporte #{reporte.id} del concepto {concepto.clave} ya fue incluido en otra estimación."}
                    )

            cantidad_ejecutada = sum((r.cantidad for r in reportes), Decimal("0"))
            if cantidad_ejecutada <= 0:
                raise ValidationError(
                    {"lineas": f"El concepto {concepto.clave} debe incluir al menos un reporte validado."}
                )

            lineas_validadas.append({
                "concepto": concepto,
                "cantidad_ejecutada": cantidad_ejecutada,
                "generador_detalle": ls.validated_data.get("generador_detalle", ""),
                "reportes": reportes,
            })

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
                    generador_detalle=item["generador_detalle"],
                )
                ReporteAvanceConcepto.objects.filter(
                    id__in=[r.id for r in item["reportes"]]
                ).update(usado_en_estimacion=estimacion)

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


class ReporteAvanceConceptoViewSet(viewsets.ModelViewSet):
    serializer_class = ReporteAvanceConceptoSerializer
    permission_classes = [IsAuthenticated, HasRolePermission]
    parser_classes = [MultiPartParser, FormParser]

    ACTION_PERMISSIONS = {
        "create": "avance_concepto.registrar",
        "revisar": "avance_concepto.validar",
    }

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        contratos = contratos_visibles_para(self.request.user)
        return ReporteAvanceConcepto.objects.filter(concepto__contrato__in=contratos).select_related(
            "concepto", "concepto__contrato", "creado_por", "revisado_por", "reporte_anterior"
        )

    def perform_create(self, serializer):
        concepto = serializer.validated_data["concepto"]
        if not contratos_visibles_para(self.request.user).filter(pk=concepto.contrato_id).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        if concepto.contrato.status != Contract.Status.ACTIVO:
            raise ValidationError("Solo se pueden registrar reportes de avance para un contrato activo.")
        if concepto.estado == ConceptoCatalogo.Estado.TERMINADO:
            raise ValidationError("El concepto ya fue marcado como terminado.")

        reporte_anterior = serializer.validated_data.get("reporte_anterior")
        if reporte_anterior is not None:
            if reporte_anterior.concepto_id != concepto.id:
                raise ValidationError({"reporte_anterior": "El reporte anterior no corresponde a este concepto."})
            if reporte_anterior.creado_por_id != self.request.user.id:
                raise PermissionDenied("Solo quien registró el reporte original puede corregirlo.")
            if reporte_anterior.status != ReporteAvanceConcepto.Status.RECHAZADO:
                raise ValidationError({"reporte_anterior": "Solo se puede corregir un reporte rechazado."})
            if hasattr(reporte_anterior, "correccion"):
                raise ValidationError({"reporte_anterior": "Este reporte ya fue corregido y reenviado."})

        cantidad = serializer.validated_data["cantidad"]
        acumulado_validado = concepto.reportes_avance.filter(
            status=ReporteAvanceConcepto.Status.VALIDADO
        ).aggregate(total=Sum("cantidad"))["total"] or Decimal("0")
        if acumulado_validado + cantidad > concepto.cantidad:
            raise ValidationError(
                {"cantidad": (
                    f"El acumulado validado ({acumulado_validado}) más esta cantidad excede "
                    f"lo autorizado para el concepto ({concepto.cantidad})."
                )}
            )

        serializer.save(creado_por=self.request.user)

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        reporte = self.get_object()
        if reporte.status != ReporteAvanceConcepto.Status.PENDIENTE:
            raise ValidationError("Solo se puede validar un reporte pendiente de validación.")

        nuevo_status = request.data.get("status")
        if nuevo_status not in (ReporteAvanceConcepto.Status.VALIDADO, ReporteAvanceConcepto.Status.RECHAZADO):
            return Response(
                {"detail": "status debe ser 'validado' o 'rechazado'."}, status=status.HTTP_400_BAD_REQUEST
            )

        observaciones = request.data.get("observaciones", "").strip()
        if nuevo_status == ReporteAvanceConcepto.Status.RECHAZADO and not observaciones:
            raise ValidationError({"observaciones": "Se requiere registrar observaciones al rechazar un reporte."})

        concepto_terminado = False
        with transaction.atomic():
            if nuevo_status == ReporteAvanceConcepto.Status.VALIDADO:
                concepto = ConceptoCatalogo.objects.select_for_update().get(pk=reporte.concepto_id)
                acumulado_validado = concepto.reportes_avance.filter(
                    status=ReporteAvanceConcepto.Status.VALIDADO
                ).aggregate(total=Sum("cantidad"))["total"] or Decimal("0")
                if acumulado_validado + reporte.cantidad > concepto.cantidad:
                    raise ValidationError(
                        "El acumulado validado excede la cantidad autorizada para este concepto."
                    )

            reporte.status = nuevo_status
            reporte.observaciones = observaciones
            reporte.revisado_por = request.user
            reporte.fecha_revision = timezone.now()
            reporte.save(update_fields=["status", "observaciones", "revisado_por", "fecha_revision"])

            if nuevo_status == ReporteAvanceConcepto.Status.VALIDADO:
                concepto_terminado = evaluar_terminacion_concepto(reporte.concepto)

        data = ReporteAvanceConceptoSerializer(reporte, context=self.get_serializer_context()).data
        if concepto_terminado:
            data["concepto_terminado"] = True
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
    # Un convenio queda append-only + revisar: no se permite editar ni borrar
    # una vez solicitado, para no perder el rastro de auditoría.
    http_method_names = ["get", "post", "head", "options"]

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

        if contrato.status != Contract.Status.ACTIVO:
            raise ValidationError(
                {"contrato_id": "Solo se pueden solicitar convenios modificatorios para un contrato activo."}
            )

        try:
            validar_convenio_pendiente_unico(contrato)
        except Exception as e:
            raise ValidationError({"contrato_id": str(e)})

        try:
            validar_tope_convenio(
                contrato,
                serializer.validated_data.get("monto_adicional") or Decimal("0"),
                serializer.validated_data.get("dias_adicionales") or 0,
            )
        except ValueError as e:
            raise ValidationError({"monto_adicional": str(e)})

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

        motivo_rechazo = request.data.get("motivo_rechazo", "").strip()
        if nuevo_status == Convenio.Status.RECHAZADO and not motivo_rechazo:
            raise ValidationError({"motivo_rechazo": "Se requiere especificar el motivo del rechazo."})

        with transaction.atomic():
            if nuevo_status == Convenio.Status.APROBADO:
                try:
                    validar_tope_convenio(convenio.contrato, convenio.monto_adicional, convenio.dias_adicionales)
                except ValueError as e:
                    raise ValidationError({"monto_adicional": str(e)})
                self._aplicar_convenio(convenio)

            convenio.status = nuevo_status
            convenio.motivo_rechazo = motivo_rechazo
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
        if convenio.dias_adicionales:
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
    ACTION_PERMISSIONS = {
        "create": "incumplimiento.registrar",
        "resolver": "incumplimiento.resolver",
    }

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

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        incumplimiento = self.get_object()
        if not contratos_visibles_para(self.request.user).filter(pk=incumplimiento.contrato_id).exists():
            raise PermissionDenied("No tienes acceso a este contrato.")
        incumplimiento.resuelto = True
        incumplimiento.save(update_fields=["resuelto"])
        return Response(IncumplimientoSerializer(incumplimiento, context=self.get_serializer_context()).data)


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

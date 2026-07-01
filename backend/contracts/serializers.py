from datetime import timedelta
from decimal import Decimal

from rest_framework import serializers

from .models import (
    ActaEntregaRecepcion,
    Anticipo,
    AvanceDiario,
    Bitacora,
    BitacoraNote,
    BitacoraNoteFoto,
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Convenio,
    ConvenioDocumento,
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
    calcular_garantia_status,
)


class PersonaCompactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = ["id", "nombre", "rfc", "telefono", "correo"]


class ContratistaSerializer(serializers.ModelSerializer):
    superintendentes = PersonaCompactSerializer(many=True, read_only=True)

    class Meta:
        model = Contratista
        fields = ["id", "nombre", "rfc", "representante", "telefono", "correo", "superintendentes"]


class EmpresaSupervisionSerializer(serializers.ModelSerializer):
    supervisores = PersonaCompactSerializer(many=True, read_only=True)

    class Meta:
        model = EmpresaSupervision
        fields = ["id", "nombre", "rfc", "representante", "telefono", "correo", "supervisores"]


class PersonaSerializer(serializers.ModelSerializer):
    empresa_contratista = serializers.PrimaryKeyRelatedField(
        queryset=Contratista.objects.all(), allow_null=True, required=False
    )
    empresa_supervision = serializers.PrimaryKeyRelatedField(
        queryset=EmpresaSupervision.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Persona
        fields = ["id", "nombre", "rfc", "telefono", "correo", "empresa_contratista", "empresa_supervision"]


class ConceptoCatalogoSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ConceptoCatalogo
        fields = [
            "id", "clave", "descripcion", "unidad", "cantidad", "precio_unitario", "total", "capitulo", "estado",
        ]


class ContractDocumentSerializer(serializers.ModelSerializer):
    archivo = serializers.FileField(required=True)
    subido_por = serializers.SerializerMethodField()

    class Meta:
        model = ContractDocument
        fields = ["id", "bloque", "nombre", "archivo", "formato", "tamano", "fecha", "subido_por"]
        read_only_fields = ["formato", "tamano", "fecha"]

    def get_subido_por(self, obj):
        return obj.subido_por.get_full_name() if obj.subido_por else None


class ContractVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractVersion
        fields = ["version", "fecha", "monto", "fecha_termino", "motivo", "catalogo_snapshot"]


class SolicitudActivacionSerializer(serializers.ModelSerializer):
    solicitado_por = serializers.SerializerMethodField()
    revisado_por = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudActivacion
        fields = [
            "status",
            "solicitado_por",
            "fecha_solicitud",
            "revisado_por",
            "fecha_revision",
            "observaciones",
        ]

    def get_solicitado_por(self, obj):
        return obj.solicitado_por.get_full_name() if obj.solicitado_por else None

    def get_revisado_por(self, obj):
        return obj.revisado_por.get_full_name() if obj.revisado_por else None


class BitacoraNoteFotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = BitacoraNoteFoto
        fields = ["id", "imagen", "fecha"]


class BitacoraNoteSerializer(serializers.ModelSerializer):
    autor = serializers.SerializerMethodField()
    fotos = BitacoraNoteFotoSerializer(many=True, read_only=True)
    conceptos = serializers.SerializerMethodField()
    nota_padre_numero = serializers.SerializerMethodField()

    class Meta:
        model = BitacoraNote
        fields = [
            "id", "numero", "tipo", "contenido", "autor", "rol", "fecha",
            "firmas", "fotos", "conceptos", "nota_padre_numero",
        ]

    def get_autor(self, obj):
        return obj.autor.get_full_name() if obj.autor else None

    def get_conceptos(self, obj):
        return [{"id": c.id, "clave": c.clave} for c in obj.conceptos.all()]

    def get_nota_padre_numero(self, obj):
        return obj.nota_padre.numero if obj.nota_padre_id else None


class BitacoraNoteCreateSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=BitacoraNote.Tipo.choices)
    contenido = serializers.CharField()
    conceptos = serializers.PrimaryKeyRelatedField(
        queryset=ConceptoCatalogo.objects.all(), many=True, required=False, default=list
    )
    nota_padre = serializers.PrimaryKeyRelatedField(
        queryset=BitacoraNote.objects.all(), required=False, allow_null=True, default=None
    )

    def validate(self, data):
        if data.get("tipo") == BitacoraNote.Tipo.CONCEPTO_TERMINADO and not data.get("conceptos"):
            raise serializers.ValidationError(
                {"conceptos": "Debe seleccionar al menos un concepto para este tipo de nota."}
            )
        return data


class BitacoraSerializer(serializers.ModelSerializer):
    notas = BitacoraNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Bitacora
        fields = ["abierta", "fecha_apertura", "nota_apertura", "notas"]


class ContractCompactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = ["id", "no_contrato", "objeto"]


class OrdenPagoSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    estimacion_numero = serializers.IntegerField(source="estimacion.numero", read_only=True)

    class Meta:
        model = OrdenPago
        fields = [
            "id",
            "contrato",
            "estimacion",
            "estimacion_numero",
            "monto",
            "fecha_emision",
            "status",
            "fecha_atencion",
        ]
        read_only_fields = ["contrato", "estimacion", "monto", "fecha_emision", "status", "fecha_atencion"]


class LineaEstimacionSerializer(serializers.ModelSerializer):
    concepto_id = serializers.IntegerField(read_only=True)
    clave = serializers.CharField(source="concepto.clave", read_only=True)
    descripcion = serializers.CharField(source="concepto.descripcion", read_only=True)
    unidad = serializers.CharField(source="concepto.unidad", read_only=True)
    cantidad_contratada = serializers.DecimalField(
        source="concepto.cantidad", max_digits=14, decimal_places=2, read_only=True
    )
    porcentaje_avance = serializers.SerializerMethodField()

    class Meta:
        model = LineaEstimacion
        fields = [
            "id",
            "concepto_id",
            "clave",
            "descripcion",
            "unidad",
            "cantidad_contratada",
            "cantidad_ejecutada",
            "cantidad_acumulada",
            "generador_detalle",
            "porcentaje_avance",
        ]

    def get_porcentaje_avance(self, obj):
        if not obj.concepto.cantidad:
            return 0
        return round(float(obj.cantidad_acumulada / obj.concepto.cantidad * 100), 1)


class LineaEstimacionInputSerializer(serializers.Serializer):
    concepto_id = serializers.PrimaryKeyRelatedField(
        queryset=ConceptoCatalogo.objects.all(), source="concepto"
    )
    reporte_ids = serializers.PrimaryKeyRelatedField(
        queryset=ReporteAvanceConcepto.objects.all(), many=True
    )
    generador_detalle = serializers.CharField(required=False, allow_blank=True, default="")


class ReporteAvanceConceptoSerializer(serializers.ModelSerializer):
    concepto = ConceptoCatalogoSerializer(read_only=True)
    concepto_id = serializers.PrimaryKeyRelatedField(
        queryset=ConceptoCatalogo.objects.all(), source="concepto", write_only=True
    )
    reporte_anterior = serializers.PrimaryKeyRelatedField(
        queryset=ReporteAvanceConcepto.objects.all(), required=False, allow_null=True
    )
    creado_por = serializers.SerializerMethodField()
    revisado_por = serializers.SerializerMethodField()

    class Meta:
        model = ReporteAvanceConcepto
        fields = [
            "id", "concepto", "concepto_id", "reporte_anterior", "fecha", "cantidad",
            "frente_ubicacion", "fotografia", "status", "observaciones",
            "usado_en_estimacion", "creado_por", "fecha_creacion",
            "revisado_por", "fecha_revision",
        ]
        read_only_fields = [
            "status", "observaciones", "usado_en_estimacion", "fecha_creacion",
            "fecha_revision",
        ]

    def get_creado_por(self, obj):
        return obj.creado_por.get_full_name() if obj.creado_por else None

    def get_revisado_por(self, obj):
        return obj.revisado_por.get_full_name() if obj.revisado_por else None


class EstimacionSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    creada_por = serializers.SerializerMethodField()
    creada_por_id = serializers.IntegerField(read_only=True, allow_null=True)
    orden_pago = OrdenPagoSerializer(read_only=True, default=None)
    lineas = LineaEstimacionSerializer(many=True, read_only=True)

    class Meta:
        model = Estimacion
        fields = [
            "id",
            "contrato",
            "contrato_id",
            "numero",
            "periodo_inicio",
            "periodo_fin",
            "caratula",
            "numeros_generadores",
            "registro_fotografico",
            "notas_soporte",
            "status",
            "observaciones",
            "creada_por",
            "creada_por_id",
            "fecha_creacion",
            "importe_bruto",
            "amortizacion_anticipo",
            "retencion_garantia",
            "iva",
            "importe_neto",
            "orden_pago",
            "lineas",
        ]
        read_only_fields = [
            "numero",
            "status",
            "observaciones",
            "amortizacion_anticipo",
            "retencion_garantia",
            "iva",
            "importe_neto",
        ]

    def get_creada_por(self, obj):
        return obj.creada_por.get_full_name() if obj.creada_por else None


class GarantiaSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    documento = ContractDocumentSerializer(read_only=True)
    archivo = serializers.FileField(write_only=True, required=False)
    status = serializers.SerializerMethodField()
    registrado_por = serializers.SerializerMethodField()
    liberada_por = serializers.SerializerMethodField()

    class Meta:
        model = Garantia
        fields = [
            "id",
            "contrato",
            "contrato_id",
            "tipo",
            "institucion_afianzadora",
            "numero_poliza",
            "monto",
            "fecha_emision",
            "fecha_vigencia",
            "documento",
            "archivo",
            "status",
            "registrado_por",
            "fecha_registro",
            "liberada_por",
            "fecha_liberacion",
        ]
        read_only_fields = ["fecha_registro", "fecha_liberacion"]

    def get_status(self, obj):
        if obj.liberada_por_id:
            return "liberada"
        return calcular_garantia_status(obj.fecha_vigencia)

    def get_registrado_por(self, obj):
        return obj.registrado_por.get_full_name() if obj.registrado_por else None

    def get_liberada_por(self, obj):
        return obj.liberada_por.get_full_name() if obj.liberada_por else None


class AnticipoSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    garantia = serializers.PrimaryKeyRelatedField(queryset=Garantia.objects.all(), required=False, allow_null=True)

    class Meta:
        model = Anticipo
        fields = [
            "id",
            "contrato",
            "contrato_id",
            "monto_otorgado",
            "porcentaje_contrato",
            "porcentaje_amortizacion",
            "fecha_entrega",
            "saldo_pendiente",
            "garantia",
        ]
        read_only_fields = ["saldo_pendiente"]

    def validate(self, attrs):
        garantia = attrs.get("garantia")
        monto_otorgado = attrs.get("monto_otorgado")
        porcentaje_contrato = attrs.get("porcentaje_contrato")
        if garantia and monto_otorgado is not None and garantia.monto != monto_otorgado:
            raise serializers.ValidationError({
                "garantia": (
                    f"El monto de la garantía ({garantia.monto}) debe coincidir "
                    f"con el monto del anticipo ({monto_otorgado})."
                )
            })
        if porcentaje_contrato is not None and porcentaje_contrato > 50:
            raise serializers.ValidationError({
                "porcentaje_contrato": "El anticipo no puede exceder el 50% del monto contratado."
            })
        return attrs


class ConvenioConceptoAfectadoSerializer(serializers.Serializer):
    concepto_id = serializers.IntegerField()
    cantidad_anterior = serializers.DecimalField(max_digits=14, decimal_places=2)
    cantidad_nueva = serializers.DecimalField(max_digits=14, decimal_places=2)


class ConvenioConceptoNuevoSerializer(serializers.Serializer):
    clave = serializers.CharField()
    descripcion = serializers.CharField()
    unidad = serializers.CharField()
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=2)
    precio_unitario = serializers.DecimalField(max_digits=14, decimal_places=2)
    capitulo = serializers.CharField(required=False, allow_blank=True)


class ConvenioDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvenioDocumento
        fields = ["id", "nombre", "archivo", "fecha"]


class ConvenioSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    solicitado_por = serializers.SerializerMethodField()
    documentos = ConvenioDocumentoSerializer(many=True, read_only=True)
    conceptos_afectados = serializers.JSONField(required=False, allow_null=True)
    conceptos_nuevos = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = Convenio
        fields = [
            "id",
            "contrato",
            "contrato_id",
            "tipo",
            "justificacion",
            "monto_adicional",
            "dias_adicionales",
            "alcance",
            "conceptos_afectados",
            "conceptos_nuevos",
            "status",
            "motivo_rechazo",
            "solicitado_por",
            "fecha_solicitud",
            "documentos",
        ]
        read_only_fields = ["status", "motivo_rechazo", "fecha_solicitud"]

    def get_solicitado_por(self, obj):
        return obj.solicitado_por.get_full_name() if obj.solicitado_por else None

    def validate_monto_adicional(self, value):
        if value < 0:
            raise serializers.ValidationError("El monto adicional no puede ser negativo.")
        return value

    def validate_dias_adicionales(self, value):
        if value < 0:
            raise serializers.ValidationError("Los días adicionales no pueden ser negativos.")
        return value

    def validate(self, data):
        tipo = data.get("tipo")
        monto_adicional = data.get("monto_adicional") or 0
        dias_adicionales = data.get("dias_adicionales") or 0
        if tipo in (Convenio.Tipo.MONTO, Convenio.Tipo.AMBOS) and not monto_adicional:
            raise serializers.ValidationError(
                {"monto_adicional": "Requerido cuando el tipo de convenio incluye modificación de monto."}
            )
        if tipo in (Convenio.Tipo.PLAZO, Convenio.Tipo.AMBOS) and not dias_adicionales:
            raise serializers.ValidationError(
                {"dias_adicionales": "Requerido cuando el tipo de convenio incluye ampliación de plazo."}
            )
        return data


class AvanceDiarioSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    autor = serializers.SerializerMethodField()

    class Meta:
        model = AvanceDiario
        fields = ["id", "contrato", "contrato_id", "tipo", "descripcion", "evidencia", "autor", "fecha"]
        read_only_fields = ["fecha"]

    def get_autor(self, obj):
        return obj.autor.get_full_name() if obj.autor else None


class IncumplimientoSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    autor = serializers.SerializerMethodField()

    class Meta:
        model = Incumplimiento
        fields = ["id", "contrato", "contrato_id", "tipo", "descripcion", "evidencia_ref", "autor", "fecha", "resuelto"]
        read_only_fields = ["fecha"]

    def get_autor(self, obj):
        return obj.autor.get_full_name() if obj.autor else None


class MinutaSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    autor = serializers.SerializerMethodField()

    class Meta:
        model = Minuta
        fields = [
            "id",
            "contrato",
            "contrato_id",
            "titulo",
            "participantes",
            "acuerdos",
            "observaciones",
            "compromisos",
            "autor",
            "fecha",
        ]
        read_only_fields = ["fecha"]

    def get_autor(self, obj):
        return obj.autor.get_full_name() if obj.autor else None


class ActaEntregaRecepcionSerializer(serializers.ModelSerializer):
    registrado_por = serializers.SerializerMethodField()

    class Meta:
        model = ActaEntregaRecepcion
        fields = ["id", "fecha_firma", "archivo", "registrado_por", "fecha_registro"]
        read_only_fields = ["fecha_registro"]

    def get_registrado_por(self, obj):
        return obj.registrado_por.get_full_name() if obj.registrado_por else None


class TerminacionContratoSerializer(serializers.ModelSerializer):
    registrado_por = serializers.SerializerMethodField()
    acta = ActaEntregaRecepcionSerializer(read_only=True, default=None)

    class Meta:
        model = TerminacionContrato
        fields = [
            "id", "tipo", "fecha_terminacion", "avance_fisico_final",
            "nota_cierre", "motivo", "registrado_por", "fecha_registro",
            "cierre_status", "acta",
        ]
        read_only_fields = ["fecha_registro", "cierre_status"]

    def get_registrado_por(self, obj):
        return obj.registrado_por.get_full_name() if obj.registrado_por else None


class FiniquitoSerializer(serializers.ModelSerializer):
    emitido_por = serializers.SerializerMethodField()

    class Meta:
        model = Finiquito
        fields = [
            "id",
            "estimaciones_pendientes", "ajuste_precios", "otros_creditos_contratista",
            "saldo_anticipo_no_amortizado", "penas_convencionales", "deducibles",
            "total_creditos_contratista", "total_creditos_dependencia", "saldo_neto",
            "status", "fecha_notificacion", "fecha_limite_respuesta",
            "conformidad", "motivo_inconformidad",
            "emitido_por", "fecha_creacion",
        ]
        read_only_fields = [
            "saldo_anticipo_no_amortizado",
            "total_creditos_contratista", "total_creditos_dependencia", "saldo_neto",
            "status", "fecha_notificacion", "fecha_limite_respuesta",
            "conformidad", "fecha_creacion",
        ]

    def get_emitido_por(self, obj):
        return obj.emitido_por.get_full_name() if obj.emitido_por else None


class MesConceptoSerializer(serializers.Serializer):
    mes = serializers.IntegerField(min_value=1)
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)


class ConceptoProgramaSerializer(serializers.Serializer):
    concepto_id = serializers.IntegerField()
    meses = MesConceptoSerializer(many=True)


class ProgramaObraSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramaObra
        fields = ["conceptos", "updated_at"]


class ContractSerializer(serializers.ModelSerializer):
    acumulado_convenios = serializers.SerializerMethodField()
    contratista = ContratistaSerializer(read_only=True)
    contratista_id = serializers.PrimaryKeyRelatedField(
        queryset=Contratista.objects.all(), source="contratista", write_only=True
    )
    residente = PersonaSerializer(read_only=True)
    residente_id = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(), source="residente", write_only=True
    )
    supervisor = PersonaSerializer(read_only=True)
    supervisor_id = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(), source="supervisor", write_only=True
    )
    superintendente = PersonaSerializer(read_only=True)
    superintendente_id = serializers.PrimaryKeyRelatedField(
        queryset=Persona.objects.all(), source="superintendente", write_only=True
    )
    empresa_supervision_id = serializers.PrimaryKeyRelatedField(
        queryset=EmpresaSupervision.objects.all(),
        source="empresa_supervision",
        write_only=True,
        required=False,
        allow_null=True,
    )
    documentos = ContractDocumentSerializer(many=True, read_only=True)
    catalogo_conceptos = ConceptoCatalogoSerializer(many=True, read_only=True)
    versiones = ContractVersionSerializer(many=True, read_only=True)
    solicitud_activacion = SolicitudActivacionSerializer(read_only=True, default=None)
    bitacora = BitacoraSerializer(read_only=True, default=None)
    estimaciones = EstimacionSerializer(many=True, read_only=True)
    garantias = GarantiaSerializer(many=True, read_only=True)
    anticipo = AnticipoSerializer(read_only=True, default=None)
    convenios = ConvenioSerializer(many=True, read_only=True)
    avances = AvanceDiarioSerializer(many=True, read_only=True)
    incumplimientos = IncumplimientoSerializer(many=True, read_only=True)
    minutas = MinutaSerializer(many=True, read_only=True)
    programa_obra = ProgramaObraSerializer(read_only=True, default=None)
    terminacion = TerminacionContratoSerializer(read_only=True, default=None)
    finiquito = FiniquitoSerializer(read_only=True, default=None)
    reportes_avance = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id",
            "no_contrato",
            "objeto",
            "descripcion",
            "monto",
            "monto_original",
            "plazo_dias",
            "plazo_dias_original",
            "fecha_inicio",
            "fecha_termino",
            "ubicacion",
            "contratista",
            "contratista_id",
            "residente",
            "residente_id",
            "supervisor",
            "supervisor_id",
            "superintendente",
            "superintendente_id",
            "empresa_supervision_id",
            "status",
            "version",
            "avance_programado",
            "avance_real",
            "fecha_activacion",
            "documentos",
            "catalogo_conceptos",
            "versiones",
            "solicitud_activacion",
            "bitacora",
            "estimaciones",
            "garantias",
            "anticipo",
            "convenios",
            "avances",
            "incumplimientos",
            "minutas",
            "programa_obra",
            "terminacion",
            "finiquito",
            "reportes_avance",
            "acumulado_convenios",
        ]
        read_only_fields = [
            "monto_original", "plazo_dias_original", "acumulado_convenios",
            "status", "version", "avance_programado", "avance_real", "fecha_activacion", "fecha_termino",
            "terminacion", "finiquito", "reportes_avance",
        ]

    def get_reportes_avance(self, obj):
        reportes = ReporteAvanceConcepto.objects.filter(concepto__contrato=obj).select_related(
            "concepto", "creado_por", "revisado_por", "reporte_anterior"
        )
        return ReporteAvanceConceptoSerializer(reportes, many=True, context=self.context).data

    def validate(self, data):
        fecha_inicio = data.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        plazo_dias = data.get("plazo_dias", getattr(self.instance, "plazo_dias", None))
        if fecha_inicio and plazo_dias is not None:
            data["fecha_termino"] = fecha_inicio + timedelta(days=plazo_dias)

        contratista = data.get("contratista", getattr(self.instance, "contratista", None))
        superintendente = data.get("superintendente", getattr(self.instance, "superintendente", None))
        if contratista and superintendente and superintendente.empresa_contratista_id != contratista.id:
            raise serializers.ValidationError({
                "superintendente_id": "El superintendente no pertenece a la empresa contratista seleccionada."
            })

        empresa_supervision = data.get("empresa_supervision", getattr(self.instance, "empresa_supervision", None))
        supervisor = data.get("supervisor", getattr(self.instance, "supervisor", None))
        if empresa_supervision and supervisor and supervisor.empresa_supervision_id != empresa_supervision.id:
            raise serializers.ValidationError({
                "supervisor_id": "El supervisor no pertenece a la empresa de supervisión seleccionada."
            })

        residente = data.get("residente", getattr(self.instance, "residente", None))
        if residente and supervisor and residente.id == supervisor.id:
            raise serializers.ValidationError({
                "supervisor_id": "El supervisor no puede ser la misma persona que el residente."
            })

        if supervisor and contratista and getattr(supervisor, "empresa_contratista_id", None) == contratista.id:
            raise serializers.ValidationError({
                "supervisor_id": "La supervisión no puede pertenecer a la empresa contratista."
            })

        return data

    def get_acumulado_convenios(self, obj):
        from .models import calcular_acumulado_convenios
        return calcular_acumulado_convenios(obj)

    def create(self, validated_data):
        contract = Contract.objects.create(**validated_data)
        # Fijar montos originales en la creación
        contract.monto_original = contract.monto
        contract.plazo_dias_original = contract.plazo_dias
        contract.save(update_fields=["monto_original", "plazo_dias_original"])
        ContractVersion.objects.create(
            contrato=contract,
            version=1,
            fecha=contract.fecha_inicio,
            monto=contract.monto,
            fecha_termino=contract.fecha_termino,
            motivo="Contrato original",
        )
        return contract

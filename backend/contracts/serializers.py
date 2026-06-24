from rest_framework import serializers

from .models import (
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
    Estimacion,
    Garantia,
    Incumplimiento,
    Minuta,
    OrdenPago,
    Persona,
    ProgramaObra,
    SolicitudActivacion,
    calcular_garantia_status,
)


class ContratistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contratista
        fields = ["id", "nombre", "rfc", "representante", "telefono", "correo"]


class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = ["id", "nombre", "rfc", "telefono", "correo"]


class ConceptoCatalogoSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ConceptoCatalogo
        fields = ["id", "clave", "descripcion", "unidad", "cantidad", "precio_unitario", "total", "capitulo"]


class ContractDocumentSerializer(serializers.ModelSerializer):
    archivo = serializers.FileField(required=True)
    subido_por = serializers.SerializerMethodField()

    class Meta:
        model = ContractDocument
        fields = ["id", "bloque", "nombre", "archivo", "formato", "tamano", "fecha", "subido_por"]
        read_only_fields = ["formato", "tamano"]

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

    class Meta:
        model = BitacoraNote
        fields = ["id", "numero", "tipo", "contenido", "autor", "rol", "fecha", "firmas", "fotos"]

    def get_autor(self, obj):
        return obj.autor.get_full_name() if obj.autor else None


class BitacoraNoteCreateSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=BitacoraNote.Tipo.choices)
    contenido = serializers.CharField()


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


class EstimacionSerializer(serializers.ModelSerializer):
    contrato = ContractCompactSerializer(read_only=True)
    contrato_id = serializers.PrimaryKeyRelatedField(
        queryset=Contract.objects.all(), source="contrato", write_only=True
    )
    creada_por = serializers.SerializerMethodField()
    orden_pago = OrdenPagoSerializer(read_only=True, default=None)

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
            "fecha_creacion",
            "importe_bruto",
            "amortizacion_anticipo",
            "retencion_garantia",
            "iva",
            "importe_neto",
            "orden_pago",
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
        fields = ["id", "contrato", "contrato_id", "tipo", "descripcion", "evidencia_ref", "autor", "fecha"]
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


class SemanaConceptoSerializer(serializers.Serializer):
    semana = serializers.IntegerField(min_value=1)
    cantidad = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=0)


class ConceptoProgramaSerializer(serializers.Serializer):
    concepto_id = serializers.IntegerField()
    semanas = SemanaConceptoSerializer(many=True)


class ProgramaObraSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramaObra
        fields = ["conceptos", "updated_at"]


class ContractSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = Contract
        fields = [
            "id",
            "no_contrato",
            "objeto",
            "descripcion",
            "monto",
            "plazo_dias",
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
        ]
        read_only_fields = ["status", "version", "avance_programado", "avance_real", "fecha_activacion"]

    def create(self, validated_data):
        contract = Contract.objects.create(**validated_data)
        ContractVersion.objects.create(
            contrato=contract,
            version=1,
            fecha=contract.fecha_inicio,
            monto=contract.monto,
            fecha_termino=contract.fecha_termino,
            motivo="Contrato original",
        )
        return contract

from rest_framework import serializers

from .models import (
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Persona,
    SolicitudActivacion,
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
    subido_por = serializers.SerializerMethodField()

    class Meta:
        model = ContractDocument
        fields = ["id", "bloque", "nombre", "formato", "tamano", "fecha", "subido_por"]

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
    documentos = ContractDocumentSerializer(many=True, read_only=True)
    catalogo_conceptos = ConceptoCatalogoSerializer(many=True, read_only=True)
    versiones = ContractVersionSerializer(many=True, read_only=True)
    solicitud_activacion = SolicitudActivacionSerializer(read_only=True, default=None)

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
            "status",
            "version",
            "avance_programado",
            "avance_real",
            "fecha_activacion",
            "documentos",
            "catalogo_conceptos",
            "versiones",
            "solicitud_activacion",
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

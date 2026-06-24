from datetime import date

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import Role
from users.permissions import HasRolePermission

from .models import ConceptoCatalogo, Contract, ContractDocument, Contratista, Persona, SolicitudActivacion
from .serializers import (
    ConceptoCatalogoSerializer,
    ContractDocumentSerializer,
    ContractSerializer,
    ContratistaSerializer,
    PersonaSerializer,
)


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
    }

    # Roles que solo deben ver los contratos donde están asignados como
    # residente/supervisor/superintendente. dependencia y finanzas son roles
    # de control transversal y ven todos los contratos.
    ROLES_VISIBILIDAD_RESTRINGIDA = {Role.RESIDENTE, Role.SUPERVISION, Role.SUPERINTENDENTE}

    def get_permissions(self):
        self.required_action = self.ACTION_PERMISSIONS.get(self.action)
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        qs = Contract.objects.select_related(
            "contratista", "residente", "supervisor", "superintendente", "solicitud_activacion"
        ).prefetch_related("documentos", "catalogo_conceptos", "versiones")

        user = self.request.user
        if user.role in self.ROLES_VISIBILIDAD_RESTRINGIDA:
            if not user.persona_id:
                return qs.none()
            qs = qs.filter(
                Q(residente_id=user.persona_id)
                | Q(supervisor_id=user.persona_id)
                | Q(superintendente_id=user.persona_id)
            )
        return qs

    @action(detail=True, methods=["get", "post"], url_path="documentos")
    def documentos(self, request, pk=None):
        contrato = self.get_object()
        if request.method == "POST":
            serializer = ContractDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(contrato=contrato, subido_por=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(ContractDocumentSerializer(contrato.documentos.all(), many=True).data)

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

        return Response(ContractSerializer(contrato).data)

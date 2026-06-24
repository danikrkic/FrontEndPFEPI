from decimal import Decimal

from django.conf import settings
from django.db import models


class Contratista(models.Model):
    nombre = models.CharField(max_length=200)
    rfc = models.CharField(max_length=20)
    representante = models.CharField(max_length=200)
    telefono = models.CharField(max_length=30)
    correo = models.EmailField()

    def __str__(self):
        return self.nombre


class Persona(models.Model):
    nombre = models.CharField(max_length=200)
    rfc = models.CharField(max_length=20)
    telefono = models.CharField(max_length=30)
    correo = models.EmailField()

    class Meta:
        verbose_name_plural = "personas"

    def __str__(self):
        return self.nombre


class Contract(models.Model):
    class Status(models.TextChoices):
        REGISTRADO = "registrado", "Registrado"
        ACTIVO = "activo", "Activo"
        EN_CIERRE = "en_cierre", "En cierre"
        CERRADO = "cerrado", "Cerrado"

    no_contrato = models.CharField(max_length=50, unique=True)
    objeto = models.CharField(max_length=300)
    descripcion = models.TextField(blank=True)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    plazo_dias = models.PositiveIntegerField()
    fecha_inicio = models.DateField()
    fecha_termino = models.DateField()
    ubicacion = models.CharField(max_length=300, blank=True)
    contratista = models.ForeignKey(Contratista, on_delete=models.PROTECT, related_name="contratos")
    residente = models.ForeignKey(Persona, on_delete=models.PROTECT, related_name="contratos_como_residente")
    supervisor = models.ForeignKey(Persona, on_delete=models.PROTECT, related_name="contratos_como_supervisor")
    superintendente = models.ForeignKey(
        Persona, on_delete=models.PROTECT, related_name="contratos_como_superintendente"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REGISTRADO)
    version = models.PositiveIntegerField(default=1)
    avance_programado = models.PositiveSmallIntegerField(default=0)
    avance_real = models.PositiveSmallIntegerField(default=0)
    fecha_activacion = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.no_contrato


class ConceptoCatalogo(models.Model):
    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="catalogo_conceptos")
    clave = models.CharField(max_length=50)
    descripcion = models.CharField(max_length=300)
    unidad = models.CharField(max_length=20)
    cantidad = models.DecimalField(max_digits=14, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=14, decimal_places=2)
    total = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    capitulo = models.CharField(max_length=200, blank=True)

    def save(self, *args, **kwargs):
        self.total = Decimal(str(self.cantidad)) * Decimal(str(self.precio_unitario))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.clave} - {self.descripcion}"


class ContractDocument(models.Model):
    class Bloque(models.TextChoices):
        CONTRATO = "contrato", "Contrato Digitalizado"
        CATALOGO = "catalogo", "Catálogo de Conceptos"
        PROGRAMA = "programa", "Programa de Obra"
        JURIDICO = "juridico", "Información Jurídica"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="documentos")
    bloque = models.CharField(max_length=20, choices=Bloque.choices)
    nombre = models.CharField(max_length=200)
    formato = models.CharField(max_length=10)
    tamano = models.CharField(max_length=20)
    fecha = models.DateField()
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="documentos_subidos",
    )

    def __str__(self):
        return self.nombre


class ContractVersion(models.Model):
    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="versiones")
    version = models.PositiveIntegerField()
    fecha = models.DateField()
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_termino = models.DateField()
    motivo = models.CharField(max_length=300)
    catalogo_snapshot = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["version"]

    def __str__(self):
        return f"{self.contrato.no_contrato} v{self.version}"


class SolicitudActivacion(models.Model):
    class Status(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"

    contrato = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="solicitud_activacion")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDIENTE)
    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="solicitudes_activacion_creadas",
    )
    fecha_solicitud = models.DateField()
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="solicitudes_activacion_revisadas",
    )
    fecha_revision = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)

    def __str__(self):
        return f"Activación {self.contrato.no_contrato} ({self.status})"

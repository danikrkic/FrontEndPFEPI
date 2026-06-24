from datetime import date
from decimal import Decimal

from django.conf import settings
from django.db import models

from users.models import Role


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


def _humanize_size(num_bytes):
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024


def contract_document_upload_to(instance, filename):
    return f"documentos/contrato_{instance.contrato_id}/{filename}"


class ContractDocument(models.Model):
    class Bloque(models.TextChoices):
        CONTRATO = "contrato", "Contrato Digitalizado"
        CATALOGO = "catalogo", "Catálogo de Conceptos"
        PROGRAMA = "programa", "Programa de Obra"
        JURIDICO = "juridico", "Información Jurídica"
        GARANTIA = "garantia", "Garantía"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="documentos")
    bloque = models.CharField(max_length=20, choices=Bloque.choices)
    nombre = models.CharField(max_length=200)
    archivo = models.FileField(upload_to=contract_document_upload_to, null=True, blank=True)
    formato = models.CharField(max_length=10, blank=True)
    tamano = models.CharField(max_length=20, blank=True)
    fecha = models.DateField()
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="documentos_subidos",
    )

    def save(self, *args, **kwargs):
        if self.archivo:
            nombre_archivo = self.archivo.name.rsplit("/", 1)[-1]
            self.formato = nombre_archivo.rsplit(".", 1)[-1].upper() if "." in nombre_archivo else ""
            self.tamano = _humanize_size(self.archivo.size)
        super().save(*args, **kwargs)

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


class Bitacora(models.Model):
    contrato = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="bitacora")
    abierta = models.BooleanField(default=False)
    fecha_apertura = models.DateField(null=True, blank=True)
    nota_apertura = models.TextField(blank=True)

    def __str__(self):
        return f"Bitácora {self.contrato.no_contrato}"


# Roles que firman cada nota de bitácora, además del autor. Las etiquetas
# replican lib/types.ts (NOTE_TYPE_LABELS/ROLE_LABELS) del frontend.
ROLES_FIRMANTES = {
    Role.RESIDENTE: "Residente de Obra",
    Role.SUPERINTENDENTE: "Superintendente",
    Role.SUPERVISION: "Supervisión",
}


def construir_firmas(contrato, autor):
    """El autor firma como 'Autor'; los otros dos roles asignados al contrato
    (de los tres que pueden notear bitácora) firman también, igual que en
    store.tsx del frontend (cada nota la firman el autor + los otros dos)."""
    firmas = [{"responsable": "Autor", "nombre": autor.get_full_name(), "firma": autor.get_full_name()}]
    nombres_por_rol = {
        Role.RESIDENTE: contrato.residente.nombre,
        Role.SUPERINTENDENTE: contrato.superintendente.nombre,
        Role.SUPERVISION: contrato.supervisor.nombre,
    }
    for rol, etiqueta in ROLES_FIRMANTES.items():
        if rol != autor.role:
            firmas.append({"responsable": etiqueta, "nombre": nombres_por_rol[rol], "firma": nombres_por_rol[rol]})
    return firmas


class BitacoraNote(models.Model):
    class Tipo(models.TextChoices):
        INSTRUCCION = "instruccion", "Instrucción"
        RESPUESTA = "respuesta", "Respuesta"
        ACUERDO = "acuerdo", "Acuerdo"
        OBSERVACION = "observacion", "Observación"

    bitacora = models.ForeignKey(Bitacora, on_delete=models.CASCADE, related_name="notas")
    numero = models.PositiveIntegerField()
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    contenido = models.TextField()
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="notas_bitacora"
    )
    rol = models.CharField(max_length=20, choices=Role.choices)
    fecha = models.DateField()
    firmas = models.JSONField(default=list)

    class Meta:
        ordering = ["numero"]

    def __str__(self):
        return f"Nota {self.numero} - {self.bitacora.contrato.no_contrato}"


def bitacora_foto_upload_to(instance, filename):
    return f"bitacora/nota_{instance.nota_id}/{filename}"


class BitacoraNoteFoto(models.Model):
    nota = models.ForeignKey(BitacoraNote, on_delete=models.CASCADE, related_name="fotos")
    imagen = models.ImageField(upload_to=bitacora_foto_upload_to)
    fecha = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"Foto {self.id} - nota {self.nota_id}"


def calcular_desglose_estimacion(importe_bruto, anticipo=None, porcentaje_retencion=None, porcentaje_iva=None):
    """Replica calcularDesgloseEstimacion de lib/calculos.ts. `anticipo` (si se
    pasa) debe exponer porcentaje_amortizacion y saldo_pendiente — normalmente
    el Anticipo real del contrato, si existe."""
    porcentaje_retencion = porcentaje_retencion if porcentaje_retencion is not None else Decimal("0.05")
    porcentaje_iva = porcentaje_iva if porcentaje_iva is not None else Decimal("0.16")
    importe_bruto = Decimal(str(importe_bruto))

    if anticipo is not None:
        amortizacion = min(
            importe_bruto * (anticipo.porcentaje_amortizacion / Decimal("100")),
            anticipo.saldo_pendiente,
        )
    else:
        amortizacion = Decimal("0")

    retencion_garantia = importe_bruto * porcentaje_retencion
    base_gravable = importe_bruto - amortizacion - retencion_garantia
    iva = base_gravable * porcentaje_iva
    importe_neto = base_gravable + iva

    return {
        "amortizacion_anticipo": amortizacion,
        "retencion_garantia": retencion_garantia,
        "iva": iva,
        "importe_neto": importe_neto,
    }


class Estimacion(models.Model):
    class Status(models.TextChoices):
        EN_REVISION = "en_revision", "En revisión"
        ACEPTADA = "aceptada", "Aceptada"
        RECHAZADA = "rechazada", "Rechazada"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="estimaciones")
    numero = models.PositiveIntegerField()
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    caratula = models.CharField(max_length=300)
    numeros_generadores = models.CharField(max_length=300, blank=True)
    registro_fotografico = models.PositiveIntegerField(default=0)
    notas_soporte = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.EN_REVISION)
    observaciones = models.TextField(blank=True)
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="estimaciones_creadas"
    )
    fecha_creacion = models.DateField(auto_now_add=True)

    # Desglose financiero: importe_bruto lo da el cliente, el resto se calcula
    # siempre en el servidor con calcular_desglose_estimacion.
    importe_bruto = models.DecimalField(max_digits=14, decimal_places=2)
    amortizacion_anticipo = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=0)
    retencion_garantia = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=0)
    iva = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=0)
    importe_neto = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=0)

    class Meta:
        ordering = ["contrato", "numero"]

    def __str__(self):
        return f"Estimación {self.numero} - {self.contrato.no_contrato}"


class OrdenPago(models.Model):
    class Status(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        ATENDIDA = "atendida", "Atendida"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="ordenes_pago")
    estimacion = models.OneToOneField(Estimacion, on_delete=models.CASCADE, related_name="orden_pago")
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_emision = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDIENTE)
    fecha_atencion = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Orden de pago - {self.contrato.no_contrato} est.{self.estimacion.numero}"


def calcular_garantia_status(fecha_vigencia):
    """Replica calcularGarantiaStatus de lib/types.ts. 'liberada' nunca sale de
    aquí; se asigna manualmente vía Garantia.liberada_por."""
    diff_dias = (fecha_vigencia - date.today()).days
    if diff_dias < 0:
        return "vencida"
    if diff_dias <= 30:
        return "por_vencer"
    return "vigente"


class Garantia(models.Model):
    class Tipo(models.TextChoices):
        CUMPLIMIENTO = "cumplimiento", "Cumplimiento"
        ANTICIPO = "anticipo", "Anticipo"
        VICIOS_OCULTOS = "vicios_ocultos", "Vicios Ocultos"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="garantias")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    institucion_afianzadora = models.CharField(max_length=200)
    numero_poliza = models.CharField(max_length=100)
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_emision = models.DateField()
    fecha_vigencia = models.DateField()
    documento = models.OneToOneField(
        ContractDocument, on_delete=models.SET_NULL, null=True, blank=True, related_name="garantia"
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="garantias_registradas"
    )
    fecha_registro = models.DateField(auto_now_add=True)
    liberada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="garantias_liberadas",
    )
    fecha_liberacion = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = [["contrato", "tipo"]]

    def __str__(self):
        return f"Garantía {self.tipo} - {self.contrato.no_contrato}"


class Anticipo(models.Model):
    contrato = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="anticipo")
    monto_otorgado = models.DecimalField(max_digits=14, decimal_places=2)
    porcentaje_contrato = models.DecimalField(max_digits=5, decimal_places=2)
    porcentaje_amortizacion = models.DecimalField(max_digits=5, decimal_places=2)
    fecha_entrega = models.DateField()
    saldo_pendiente = models.DecimalField(max_digits=14, decimal_places=2, editable=False)
    garantia = models.ForeignKey(
        Garantia, on_delete=models.SET_NULL, null=True, blank=True, related_name="anticipos"
    )

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.saldo_pendiente = self.monto_otorgado
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Anticipo {self.contrato.no_contrato}"


class Convenio(models.Model):
    class Tipo(models.TextChoices):
        PLAZO = "plazo", "Ampliación de Plazo"
        MONTO = "monto", "Modificación de Monto"
        AMBOS = "ambos", "Plazo y Monto"

    class Status(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADO = "aprobado", "Aprobado"
        RECHAZADO = "rechazado", "Rechazado"

    class Alcance(models.TextChoices):
        AJUSTE_MONTO_SIMPLE = "ajuste_monto_simple", "Ajuste de monto simple"
        CONCEPTOS_NUEVOS = "conceptos_nuevos", "Conceptos nuevos"
        AJUSTE_CANTIDADES = "ajuste_cantidades", "Ajuste de cantidades"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="convenios")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    justificacion = models.TextField()
    monto_adicional = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    dias_adicionales = models.PositiveIntegerField(default=0)
    alcance = models.CharField(max_length=30, choices=Alcance.choices)
    # [{concepto_id, cantidad_anterior, cantidad_nueva}], solo si alcance=ajuste_cantidades
    conceptos_afectados = models.JSONField(null=True, blank=True)
    # [{clave, descripcion, unidad, cantidad, precio_unitario, capitulo}], solo si alcance=conceptos_nuevos
    conceptos_nuevos = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDIENTE)
    motivo_rechazo = models.TextField(blank=True)
    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="convenios_solicitados"
    )
    fecha_solicitud = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"Convenio {self.tipo} - {self.contrato.no_contrato}"


def convenio_documento_upload_to(instance, filename):
    return f"convenios/convenio_{instance.convenio_id}/{filename}"


class ConvenioDocumento(models.Model):
    convenio = models.ForeignKey(Convenio, on_delete=models.CASCADE, related_name="documentos")
    archivo = models.FileField(upload_to=convenio_documento_upload_to)
    nombre = models.CharField(max_length=200, blank=True)
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="documentos_convenio_subidos"
    )
    fecha = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.nombre or f"Documento {self.id}"


class AvanceDiario(models.Model):
    class Tipo(models.TextChoices):
        AVANCE = "avance", "Avance"
        INCIDENCIA = "incidencia", "Incidencia"
        ATRASO = "atraso", "Atraso"
        RELEVANTE = "relevante", "Situación Relevante"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="avances")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.TextField()
    evidencia = models.CharField(max_length=300, blank=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="avances_registrados"
    )
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Avance {self.tipo} - {self.contrato.no_contrato}"


class Incumplimiento(models.Model):
    class Tipo(models.TextChoices):
        ATRASO = "atraso", "Atraso"
        CALIDAD = "calidad", "Calidad"
        SEGURIDAD = "seguridad", "Seguridad"

    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="incumplimientos")
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    descripcion = models.TextField()
    evidencia_ref = models.CharField(max_length=300, blank=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="incumplimientos_registrados"
    )
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Incumplimiento {self.tipo} - {self.contrato.no_contrato}"


class Minuta(models.Model):
    contrato = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="minutas")
    titulo = models.CharField(max_length=300)
    participantes = models.TextField(blank=True)
    acuerdos = models.TextField(blank=True)
    observaciones = models.TextField(blank=True)
    compromisos = models.TextField(blank=True)
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="minutas_registradas"
    )
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Minuta - {self.titulo} ({self.contrato.no_contrato})"


class ProgramaObra(models.Model):
    contrato = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name="programa_obra")
    # [{concepto_id, semanas: [{semana, cantidad}]}] — se reemplaza completo en
    # cada PUT, igual que setProgramaObra en store.tsx.
    conceptos = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Programa de obra - {self.contrato.no_contrato}"

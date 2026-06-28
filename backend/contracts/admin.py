from django.contrib import admin

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
    EmpresaSupervision,
    Estimacion,
    Garantia,
    Incumplimiento,
    Minuta,
    OrdenPago,
    Persona,
    ProgramaObra,
    SolicitudActivacion,
)


@admin.register(Contratista)
class ContratistaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rfc", "representante", "correo")
    search_fields = ("nombre", "rfc")


@admin.register(EmpresaSupervision)
class EmpresaSupervisionAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rfc", "representante", "correo")
    search_fields = ("nombre", "rfc")


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rfc", "correo", "empresa_contratista", "empresa_supervision")
    search_fields = ("nombre", "rfc")
    list_filter = ("empresa_contratista", "empresa_supervision")


class ConceptoCatalogoInline(admin.TabularInline):
    model = ConceptoCatalogo
    extra = 0

    def _contrato_activo(self, obj):
        return obj is not None and obj.status == Contract.Status.ACTIVO

    def has_add_permission(self, request, obj=None):
        if self._contrato_activo(obj):
            return False
        return super().has_add_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        if self._contrato_activo(obj):
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if self._contrato_activo(obj):
            return False
        return super().has_delete_permission(request, obj)


class ContractDocumentInline(admin.TabularInline):
    model = ContractDocument
    extra = 0


class ContractVersionInline(admin.TabularInline):
    model = ContractVersion
    extra = 0


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ("no_contrato", "objeto", "status", "contratista", "residente", "supervisor", "superintendente")
    list_filter = ("status",)
    search_fields = ("no_contrato", "objeto")
    inlines = [ConceptoCatalogoInline, ContractDocumentInline, ContractVersionInline]


@admin.register(SolicitudActivacion)
class SolicitudActivacionAdmin(admin.ModelAdmin):
    list_display = ("contrato", "status", "solicitado_por", "revisado_por")


class BitacoraNoteInline(admin.TabularInline):
    model = BitacoraNote
    extra = 0


@admin.register(Bitacora)
class BitacoraAdmin(admin.ModelAdmin):
    list_display = ("contrato", "abierta", "fecha_apertura")
    inlines = [BitacoraNoteInline]


class BitacoraNoteFotoInline(admin.TabularInline):
    model = BitacoraNoteFoto
    extra = 0
    readonly_fields = ("fecha",)


@admin.register(BitacoraNote)
class BitacoraNoteAdmin(admin.ModelAdmin):
    list_display = ("bitacora", "numero", "tipo", "autor", "fecha")
    inlines = [BitacoraNoteFotoInline]


@admin.register(Estimacion)
class EstimacionAdmin(admin.ModelAdmin):
    list_display = ("contrato", "numero", "status", "importe_bruto", "importe_neto", "creada_por")
    list_filter = ("status",)


@admin.register(OrdenPago)
class OrdenPagoAdmin(admin.ModelAdmin):
    list_display = ("contrato", "estimacion", "monto", "status", "fecha_emision", "fecha_atencion")
    list_filter = ("status",)


@admin.register(Garantia)
class GarantiaAdmin(admin.ModelAdmin):
    list_display = ("contrato", "tipo", "institucion_afianzadora", "fecha_vigencia", "liberada_por")
    list_filter = ("tipo",)


@admin.register(Anticipo)
class AnticipoAdmin(admin.ModelAdmin):
    list_display = ("contrato", "monto_otorgado", "saldo_pendiente", "fecha_entrega")


class ConvenioDocumentoInline(admin.TabularInline):
    model = ConvenioDocumento
    extra = 0
    readonly_fields = ("fecha",)


@admin.register(Convenio)
class ConvenioAdmin(admin.ModelAdmin):
    list_display = ("contrato", "tipo", "alcance", "status", "solicitado_por", "fecha_solicitud")
    list_filter = ("status", "tipo", "alcance")
    inlines = [ConvenioDocumentoInline]


@admin.register(AvanceDiario)
class AvanceDiarioAdmin(admin.ModelAdmin):
    list_display = ("contrato", "tipo", "autor", "fecha")
    list_filter = ("tipo",)


@admin.register(Incumplimiento)
class IncumplimientoAdmin(admin.ModelAdmin):
    list_display = ("contrato", "tipo", "autor", "fecha")
    list_filter = ("tipo",)


@admin.register(Minuta)
class MinutaAdmin(admin.ModelAdmin):
    list_display = ("contrato", "titulo", "autor", "fecha")


@admin.register(ProgramaObra)
class ProgramaObraAdmin(admin.ModelAdmin):
    list_display = ("contrato", "updated_at")

from django.contrib import admin

from .models import (
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Persona,
    SolicitudActivacion,
)


@admin.register(Contratista)
class ContratistaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rfc", "representante", "correo")
    search_fields = ("nombre", "rfc")


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "rfc", "correo")
    search_fields = ("nombre", "rfc")


class ConceptoCatalogoInline(admin.TabularInline):
    model = ConceptoCatalogo
    extra = 0


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

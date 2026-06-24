from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "is_staff")
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Datos GACM", {"fields": ("role", "initials", "persona")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Datos GACM", {"fields": ("role", "initials", "persona")}),
    )

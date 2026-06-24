from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    DEPENDENCIA = "dependencia", "Dependencia"
    RESIDENTE = "residente", "Residente de Obra"
    SUPERINTENDENTE = "superintendente", "Superintendente"
    SUPERVISION = "supervision", "Supervisión"
    FINANZAS = "finanzas", "Finanzas"


class User(AbstractUser):
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    initials = models.CharField(max_length=4, blank=True)
    persona_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Vincula esta cuenta a una Persona (residente) para control de acceso a bitácora.",
    )

    def __str__(self) -> str:
        return self.email or self.username

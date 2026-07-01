from django.conf import settings
from django.core.management.base import BaseCommand

from contracts.models import Persona
from users.models import User

DEMO_USERS = [
    ("Daniel Lopez", "dependencia@gacm.mx", "dependencia", "DL", None),
    ("Carmen Ríos", "dependencia2@gacm.mx", "dependencia", "CR", None),
    ("Diego Ramírez", "residente@gacm.mx", "residente", "DR", "Diego Ramírez"),
    ("Mariana Flores", "residente2@gacm.mx", "residente", "MF", "Mariana Flores"),
    ("Hugo Treviño", "residente3@gacm.mx", "residente", "HT", "Hugo Treviño"),
    ("Víctor Castro", "superintendente@gacm.mx", "superintendente", "VC", "Víctor Castro"),
    ("Laura Sánchez", "superintendente2@gacm.mx", "superintendente", "LS", "Laura Sánchez"),
    ("Arturo Mendoza", "supervision@gacm.mx", "supervision", "AM", "Arturo Mendoza"),
    ("Patricia Núñez", "supervision2@gacm.mx", "supervision", "PN", "Patricia Núñez"),
    ("Dani Juárez", "finanzas@gacm.mx", "finanzas", "DJ", None),
    ("Roberto Ibáñez", "finanzas2@gacm.mx", "finanzas", "RI", None),
]


class Command(BaseCommand):
    help = "Crea los usuarios de demo (uno por rol) replicando lib/mock-data.ts del frontend."

    def handle(self, *args, **options):
        for name, email, role, initials, persona_nombre in DEMO_USERS:
            first_name, *rest = name.split(" ", 1)
            last_name = rest[0] if rest else ""
            persona = Persona.objects.filter(nombre=persona_nombre).first() if persona_nombre else None

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "initials": initials,
                    "persona": persona,
                },
            )
            if created:
                user.set_password(settings.DEFAULT_USER_PASSWORD)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Creado: {email} ({role})"))
            else:
                if persona and user.persona_id != persona.id:
                    user.persona = persona
                    user.save(update_fields=["persona"])
                self.stdout.write(f"Ya existía: {email}")

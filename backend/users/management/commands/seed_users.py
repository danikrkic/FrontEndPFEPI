from django.core.management.base import BaseCommand

from users.models import User

DEMO_USERS = [
    ("Daniel Lopez", "dependencia@gacm.mx", "dependencia", "DL", None),
    ("Carmen Ríos", "dependencia2@gacm.mx", "dependencia", "CR", None),
    ("Diego Ramírez", "residente@gacm.mx", "residente", "DR", "r1"),
    ("Mariana Flores", "residente2@gacm.mx", "residente", "MF", "r2"),
    ("Hugo Treviño", "residente3@gacm.mx", "residente", "HT", "r3"),
    ("Víctor Castro", "superintendente@gacm.mx", "superintendente", "VC", None),
    ("Laura Sánchez", "superintendente2@gacm.mx", "superintendente", "LS", None),
    ("Arturo Mendoza", "supervision@gacm.mx", "supervision", "AM", None),
    ("Patricia Núñez", "supervision2@gacm.mx", "supervision", "PN", None),
    ("Dani Juárez", "finanzas@gacm.mx", "finanzas", "DJ", None),
    ("Roberto Ibáñez", "finanzas2@gacm.mx", "finanzas", "RI", None),
]

DEMO_PASSWORD = "demo123"


class Command(BaseCommand):
    help = "Crea los usuarios de demo (uno por rol) replicando lib/mock-data.ts del frontend."

    def handle(self, *args, **options):
        for name, email, role, initials, persona_id in DEMO_USERS:
            first_name, *rest = name.split(" ", 1)
            last_name = rest[0] if rest else ""
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "initials": initials,
                    "persona_id": persona_id,
                },
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Creado: {email} ({role})"))
            else:
                self.stdout.write(f"Ya existía: {email}")

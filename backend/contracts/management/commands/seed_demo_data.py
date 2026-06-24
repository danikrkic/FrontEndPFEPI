from django.core.management.base import BaseCommand

from contracts.models import (
    Bitacora,
    ConceptoCatalogo,
    Contract,
    ContractDocument,
    ContractVersion,
    Contratista,
    Persona,
    construir_firmas,
)
from users.models import User

CONTRATISTAS = [
    dict(nombre="ICA S.A.", rfc="ICA840101AB1", representante="Roberto Salinas", telefono="55-1234-5678", correo="contacto@ica.mx"),
    dict(nombre="Grupo Beta", rfc="GBE920512XY9", representante="Laura Méndez", telefono="55-9876-5432", correo="proyectos@grupobeta.mx"),
    dict(nombre="Electra MX", rfc="EMX051120QW3", representante="Jorge Vega", telefono="55-4455-6677", correo="obras@electramx.mx"),
    dict(nombre="Vías del Norte", rfc="VNO110815RT5", representante="Sofía Herrera", telefono="55-2233-4455", correo="contacto@viasdelnorte.mx"),
]

RESIDENTES = [
    dict(nombre="Diego Ramírez", rfc="RAGD850301HMC", telefono="55-3001-1001", correo="diego.ramirez@gacm.mx"),
    dict(nombre="Mariana Flores", rfc="FOMA880712MDF", telefono="55-3001-1002", correo="mariana.flores@gacm.mx"),
    dict(nombre="Hugo Treviño", rfc="TEVH790920HNL", telefono="55-3001-1003", correo="hugo.trevino@gacm.mx"),
]

SUPERVISORES = [
    dict(nombre="Arturo Mendoza", rfc="MEAA820505HDF", telefono="55-4001-2001", correo="arturo.mendoza@gacm.mx"),
    dict(nombre="Patricia Núñez", rfc="NUPP900218MDF", telefono="55-4001-2002", correo="patricia.nunez@gacm.mx"),
    dict(nombre="Ricardo Salas", rfc="SARR751130HJC", telefono="55-4001-2003", correo="ricardo.salas@gacm.mx"),
]

SUPERINTENDENTES = [
    dict(nombre="Víctor Castro", rfc="CAVI780815HDF", telefono="55-5001-3001", correo="victor.castro@contratista.mx"),
    dict(nombre="Laura Sánchez", rfc="SALA830624MDF", telefono="55-5001-3002", correo="laura.sanchez@contratista.mx"),
]


class Command(BaseCommand):
    help = "Crea contratistas, personas y contratos de demo replicando lib/mock-data.ts del frontend."

    def handle(self, *args, **options):
        contratistas = [self._get_or_create(Contratista, c) for c in CONTRATISTAS]
        residentes = [self._get_or_create(Persona, p) for p in RESIDENTES]
        supervisores = [self._get_or_create(Persona, p) for p in SUPERVISORES]
        superintendentes = [self._get_or_create(Persona, p) for p in SUPERINTENDENTES]

        contratos = [
            dict(
                no_contrato="GACM-2024-001",
                objeto="Construcción Terminal 2 - Ampliación de instalaciones",
                descripcion="Construcción de la Terminal 2 incluyendo áreas de abordaje, salas de espera y conexiones.",
                monto="1200000",
                plazo_dias=365,
                fecha_inicio="2024-01-15",
                fecha_termino="2025-01-14",
                ubicacion="Zona Federal Aeroportuaria, Estado de México",
                contratista=contratistas[0],
                residente=residentes[0],
                supervisor=supervisores[0],
                superintendente=superintendentes[0],
                status=Contract.Status.ACTIVO,
                avance_programado=62,
                avance_real=58,
                documentos=[
                    dict(bloque="contrato", nombre="Contrato-GACM-2024-001.pdf", formato="PDF", tamano="2.4 MB", fecha="2024-01-15", subido_por="Diego Ramírez"),
                    dict(bloque="catalogo", nombre="Catalogo-Conceptos.xlsx", formato="XLSX", tamano="880 KB", fecha="2024-01-16", subido_por="Diego Ramírez"),
                    dict(bloque="programa", nombre="Programa-Obra.pdf", formato="PDF", tamano="1.1 MB", fecha="2024-01-16", subido_por="Diego Ramírez"),
                ],
                catalogo=[
                    dict(clave="CIM-001", descripcion="Excavación a cielo abierto en material tipo II", unidad="m³", cantidad="1250", precio_unitario="185.5"),
                    dict(clave="CIM-002", descripcion="Concreto f'c=250 kg/cm2 en cimentación", unidad="m³", cantidad="480", precio_unitario="2750"),
                    dict(clave="EST-001", descripcion="Acero de refuerzo fy=4200 kg/cm2", unidad="ton", cantidad="32.5", precio_unitario="28500"),
                ],
                bitacora=dict(
                    fecha_apertura="2024-01-15",
                    nota_apertura=(
                        "Se apertura la bitácora de obra del contrato GACM-2024-001 conforme a la LOPySRM. "
                        "Presentes el residente de obra y el superintendente."
                    ),
                    notas=[
                        dict(
                            tipo="instruccion",
                            contenido="Se instruye al contratista a iniciar trabajos de cimentación conforme al programa de obra autorizado.",
                            autor="Diego Ramírez",
                            fecha="2024-01-18",
                        ),
                        dict(
                            tipo="respuesta",
                            contenido="El superintendente confirma el inicio de trabajos de cimentación con el frente 1.",
                            autor="Víctor Castro",
                            fecha="2024-01-19",
                        ),
                        dict(
                            tipo="observacion",
                            contenido="La supervisión observa que el acero de refuerzo cumple con las especificaciones del proyecto.",
                            autor="Arturo Mendoza",
                            fecha="2024-01-25",
                        ),
                    ],
                ),
            ),
            dict(
                no_contrato="GACM-2024-002",
                objeto="Remodelación Sala B - Modernización de espacios",
                descripcion="Modernización integral de la Sala B de última espera.",
                monto="450000",
                plazo_dias=180,
                fecha_inicio="2024-03-01",
                fecha_termino="2024-08-28",
                ubicacion="Terminal 1, Sala B",
                contratista=contratistas[1],
                residente=residentes[0],
                supervisor=supervisores[1],
                superintendente=superintendentes[1],
                status=Contract.Status.EN_CIERRE,
                avance_programado=100,
                avance_real=96,
                documentos=[
                    dict(bloque="contrato", nombre="Contrato-GACM-2024-002.pdf", formato="PDF", tamano="1.9 MB", fecha="2024-03-01", subido_por="Diego Ramírez"),
                    dict(bloque="catalogo", nombre="Catalogo-Conceptos-002.xlsx", formato="XLSX", tamano="560 KB", fecha="2024-03-02", subido_por="Diego Ramírez"),
                ],
                catalogo=[],
                bitacora=dict(
                    fecha_apertura="2024-03-01",
                    nota_apertura="Se apertura la bitácora de obra del contrato GACM-2024-002 conforme a la LOPySRM.",
                    notas=[
                        dict(
                            tipo="acuerdo",
                            contenido="Se acuerda con el contratista el horario de trabajos nocturnos para no afectar operaciones.",
                            autor="Diego Ramírez",
                            fecha="2024-03-05",
                        ),
                    ],
                ),
            ),
            dict(
                no_contrato="GACM-2024-003",
                objeto="Sistema eléctrico - Actualización de infraestructura",
                descripcion="Actualización de subestaciones y tableros eléctricos.",
                monto="820000",
                plazo_dias=240,
                fecha_inicio="2024-05-01",
                fecha_termino="2024-12-27",
                ubicacion="Subestación Central",
                contratista=contratistas[2],
                residente=residentes[1],
                supervisor=supervisores[2],
                superintendente=superintendentes[1],
                status=Contract.Status.REGISTRADO,
                avance_programado=0,
                avance_real=0,
                documentos=[
                    dict(bloque="contrato", nombre="Contrato-GACM-2024-003.pdf", formato="PDF", tamano="2.1 MB", fecha="2024-05-01", subido_por="Mariana Flores"),
                ],
                catalogo=[],
            ),
            dict(
                no_contrato="GACM-2024-004",
                objeto="Pavimentación accesos - Rehabilitación de vialidades",
                descripcion="Rehabilitación de vialidades y accesos vehiculares.",
                monto="310000",
                plazo_dias=120,
                fecha_inicio="2024-02-10",
                fecha_termino="2024-06-09",
                ubicacion="Accesos Norte y Sur",
                contratista=contratistas[3],
                residente=residentes[2],
                supervisor=supervisores[0],
                superintendente=superintendentes[0],
                status=Contract.Status.ACTIVO,
                avance_programado=80,
                avance_real=71,
                documentos=[
                    dict(bloque="contrato", nombre="Contrato-GACM-2024-004.pdf", formato="PDF", tamano="1.6 MB", fecha="2024-02-10", subido_por="Hugo Treviño"),
                    dict(bloque="programa", nombre="Programa-Obra-004.pdf", formato="PDF", tamano="900 KB", fecha="2024-02-11", subido_por="Hugo Treviño"),
                ],
                catalogo=[],
                bitacora=dict(
                    fecha_apertura="2024-02-10",
                    nota_apertura="Se apertura la bitácora de obra del contrato GACM-2024-004.",
                    notas=[],
                ),
            ),
        ]

        for data in contratos:
            documentos = data.pop("documentos")
            catalogo = data.pop("catalogo")
            bitacora_data = data.pop("bitacora", None)
            contrato, created = Contract.objects.get_or_create(no_contrato=data["no_contrato"], defaults=data)
            if not created:
                self.stdout.write(f"Ya existía: {contrato.no_contrato}")
                continue

            ContractVersion.objects.create(
                contrato=contrato,
                version=1,
                fecha=contrato.fecha_inicio,
                monto=contrato.monto,
                fecha_termino=contrato.fecha_termino,
                motivo="Contrato original",
            )
            for doc in documentos:
                nombre_autor = doc.pop("subido_por")
                ContractDocument.objects.create(contrato=contrato, subido_por=self._buscar_usuario(nombre_autor), **doc)
            for concepto in catalogo:
                ConceptoCatalogo.objects.create(contrato=contrato, **concepto)

            if bitacora_data:
                notas = bitacora_data.pop("notas")
                bitacora = Bitacora.objects.create(contrato=contrato, abierta=True, **bitacora_data)
                for numero, nota in enumerate(notas, start=1):
                    nombre_autor = nota.pop("autor")
                    autor = self._buscar_usuario(nombre_autor)
                    bitacora.notas.create(
                        numero=numero,
                        autor=autor,
                        rol=autor.role,
                        firmas=construir_firmas(contrato, autor),
                        **nota,
                    )

            self.stdout.write(self.style.SUCCESS(f"Creado: {contrato.no_contrato}"))

    def _get_or_create(self, model, data):
        obj, _ = model.objects.get_or_create(rfc=data["rfc"], defaults=data)
        return obj

    def _buscar_usuario(self, nombre_completo):
        first_name, *rest = nombre_completo.split(" ", 1)
        return User.objects.filter(first_name=first_name, last_name=rest[0] if rest else "").first()

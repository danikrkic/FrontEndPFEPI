"""
Migra los registros de ProgramaObra del formato semanal (semanas) al mensual (meses).

Casos que maneja:
  1. Registro con estructura "semanas" → convierte agrupando semanas en meses (ceil(semana/4)).
  2. Registro vacío (conceptos=[]) y contrato tiene catálogo → genera distribución inventada
     con curva S distribuida en los meses del contrato.
  3. Registro ya en formato "meses" → lo deja intacto.
  4. Contrato sin ProgramaObra y con catálogo → crea uno con distribución inventada.
"""
import math

from django.core.management.base import BaseCommand

from contracts.models import Contract, ProgramaObra


def _ceil_div(a, b):
    return (a + b - 1) // b


def semana_a_mes(semana: int) -> int:
    """Convierte número de semana (1-based) a mes de obra (1-based, 4 sem/mes)."""
    return max(1, _ceil_div(semana, 4))


def meses_del_contrato(contrato) -> int:
    """Calcula el número de meses del contrato (ceil de días / 30)."""
    if not contrato.fecha_inicio or not contrato.fecha_termino:
        return 12
    diff_dias = (contrato.fecha_termino - contrato.fecha_inicio).days
    return max(1, _ceil_div(diff_dias, 30))


def pesos_curva_s(n: int) -> list[float]:
    """
    Devuelve n pesos normalizados con forma de campana (sin(x*pi)),
    que simula el ritmo típico de obra: lento inicio, pico a la mitad, desaceleración.
    """
    weights = [math.sin((i + 0.5) / n * math.pi) for i in range(n)]
    total = sum(weights)
    return [w / total for w in weights]


def generar_conceptos_mensuales(contrato) -> list[dict]:
    """
    Genera datos mensuales inventados para todos los conceptos del catálogo,
    distribuyendo la cantidad total de cada concepto con una curva S.
    """
    total_meses = meses_del_contrato(contrato)
    pesos = pesos_curva_s(total_meses)
    conceptos = []
    for c in contrato.catalogo_conceptos.all():
        cantidad_total = float(c.cantidad)
        meses = []
        acumulado = 0.0
        for i, peso in enumerate(pesos):
            mes = i + 1
            if i == total_meses - 1:
                # Último mes: asignar el restante para evitar errores de redondeo
                cantidad_mes = round(cantidad_total - acumulado, 4)
            else:
                cantidad_mes = round(cantidad_total * peso, 4)
            if cantidad_mes > 0:
                meses.append({"mes": mes, "cantidad": cantidad_mes})
                acumulado += cantidad_mes
        conceptos.append({"concepto_id": c.id, "meses": meses})
    return conceptos


def convertir_semanas_a_meses(conceptos_viejos: list[dict]) -> list[dict]:
    """
    Convierte la lista de ConceptoPrograma con estructura "semanas" a "meses".
    Agrupa las semanas en meses usando ceil(semana / 4).
    """
    resultado = []
    for cp in conceptos_viejos:
        meses_dict: dict[int, float] = {}
        for sw in cp.get("semanas", []):
            mes = semana_a_mes(int(sw["semana"]))
            meses_dict[mes] = meses_dict.get(mes, 0) + float(sw["cantidad"])
        meses = [{"mes": mes, "cantidad": round(cant, 4)} for mes, cant in sorted(meses_dict.items())]
        resultado.append({"concepto_id": cp["concepto_id"], "meses": meses})
    return resultado


def es_formato_semanas(conceptos: list[dict]) -> bool:
    """Detecta si algún concepto usa la clave "semanas" (formato antiguo)."""
    return any("semanas" in cp for cp in conceptos)


def es_formato_meses(conceptos: list[dict]) -> bool:
    """Detecta si algún concepto usa la clave "meses" (formato nuevo)."""
    return any("meses" in cp for cp in conceptos)


class Command(BaseCommand):
    help = "Migra ProgramaObra de formato semanal a mensual; genera datos inventados donde faltan."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué se haría sin modificar la base de datos.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(self.style.WARNING("⚠  Modo dry-run: no se guardarán cambios.\n"))

        contratos = Contract.objects.prefetch_related("catalogo_conceptos").select_related("programa_obra")
        convertidos = 0
        generados = 0
        intactos = 0

        for contrato in contratos:
            programa = getattr(contrato, "programa_obra", None)

            if programa is None:
                # Sin programa — crear uno con datos inventados si hay catálogo
                if not contrato.catalogo_conceptos.exists():
                    continue
                nuevos_conceptos = generar_conceptos_mensuales(contrato)
                self._log(f"[GENERAR] {contrato.no_contrato} — sin ProgramaObra, se crea con {len(nuevos_conceptos)} concepto(s).")
                if not dry_run:
                    ProgramaObra.objects.create(contrato=contrato, conceptos=nuevos_conceptos)
                generados += 1
                continue

            conceptos = programa.conceptos or []

            if not conceptos:
                # Programa vacío — generar datos inventados si hay catálogo
                if not contrato.catalogo_conceptos.exists():
                    intactos += 1
                    continue
                nuevos_conceptos = generar_conceptos_mensuales(contrato)
                self._log(f"[GENERAR] {contrato.no_contrato} — programa vacío, se llena con {len(nuevos_conceptos)} concepto(s).")
                if not dry_run:
                    programa.conceptos = nuevos_conceptos
                    programa.save(update_fields=["conceptos"])
                generados += 1

            elif es_formato_semanas(conceptos):
                # Formato antiguo — convertir semanas → meses
                nuevos_conceptos = convertir_semanas_a_meses(conceptos)
                self._log(f"[CONVERTIR] {contrato.no_contrato} — {len(nuevos_conceptos)} concepto(s) migrados de semanas a meses.")
                if not dry_run:
                    programa.conceptos = nuevos_conceptos
                    programa.save(update_fields=["conceptos"])
                convertidos += 1

            elif es_formato_meses(conceptos):
                # Ya está en el formato correcto
                self._log(f"[OK] {contrato.no_contrato} — ya en formato mensual.")
                intactos += 1

            else:
                self._log(f"[SKIP] {contrato.no_contrato} — estructura desconocida, se omite.")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Convertidos (semanas→meses): {convertidos}"))
        self.stdout.write(self.style.SUCCESS(f"Generados (datos inventados): {generados}"))
        self.stdout.write(f"Sin cambios:                  {intactos}")
        if dry_run:
            self.stdout.write(self.style.WARNING("\nNingún cambio fue guardado (dry-run)."))

    def _log(self, msg: str):
        self.stdout.write(f"  {msg}")

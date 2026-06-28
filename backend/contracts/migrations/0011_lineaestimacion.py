import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("contracts", "0010_contract_empresa_supervision"),
    ]

    operations = [
        migrations.CreateModel(
            name="LineaEstimacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cantidad_ejecutada", models.DecimalField(decimal_places=2, max_digits=14)),
                ("cantidad_acumulada", models.DecimalField(decimal_places=2, editable=False, max_digits=14)),
                ("generador_detalle", models.TextField(blank=True)),
                (
                    "concepto",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="lineas_estimacion",
                        to="contracts.conceptocatalogo",
                    ),
                ),
                (
                    "estimacion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lineas",
                        to="contracts.estimacion",
                    ),
                ),
            ],
            options={
                "unique_together": {("estimacion", "concepto")},
            },
        ),
    ]

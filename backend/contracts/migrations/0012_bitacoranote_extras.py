import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("contracts", "0011_lineaestimacion"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bitacoranote",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("instruccion", "Instrucción"),
                    ("respuesta", "Respuesta"),
                    ("acuerdo", "Acuerdo"),
                    ("observacion", "Observación"),
                    ("concepto_terminado", "Concepto Terminado"),
                ],
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="bitacoranote",
            name="nota_padre",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="respuestas",
                to="contracts.bitacoranote",
            ),
        ),
        migrations.AddField(
            model_name="bitacoranote",
            name="conceptos",
            field=models.ManyToManyField(
                blank=True,
                related_name="notas_terminacion",
                to="contracts.conceptocatalogo",
            ),
        ),
        migrations.AddField(
            model_name="estimacion",
            name="notas_soporte_bitacora",
            field=models.ManyToManyField(
                blank=True,
                related_name="estimaciones_soporte",
                to="contracts.bitacoranote",
            ),
        ),
    ]

from django.db import migrations, models
import django.db.models.expressions


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0012_bitacoranote_extras"),
    ]

    operations = [
        migrations.AddField(
            model_name="contract",
            name="monto_original",
            field=models.DecimalField(
                max_digits=14,
                decimal_places=2,
                null=True,
                blank=True,
                help_text="Monto contractual original. Se fija al crear y no cambia con convenios.",
            ),
        ),
        migrations.AddField(
            model_name="contract",
            name="plazo_dias_original",
            field=models.PositiveIntegerField(
                null=True,
                blank=True,
                help_text="Plazo en días original. Se fija al crear y no cambia con convenios.",
            ),
        ),
        # Retroactivamente poblar los campos en contratos existentes
        migrations.RunSQL(
            "UPDATE contracts_contract SET monto_original = monto, plazo_dias_original = plazo_dias "
            "WHERE monto_original IS NULL",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]

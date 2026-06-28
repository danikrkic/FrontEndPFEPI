import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0009_empresasupervision_persona_empresa_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="contract",
            name="empresa_supervision",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="contratos_supervisados",
                to="contracts.empresasupervision",
            ),
        ),
    ]

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0008_avancediario_incumplimiento_minuta_programaobra"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmpresaSupervision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=200)),
                ("rfc", models.CharField(max_length=20)),
                ("representante", models.CharField(max_length=200)),
                ("telefono", models.CharField(max_length=30)),
                ("correo", models.EmailField(max_length=254)),
            ],
            options={
                "verbose_name": "empresa de supervisión",
                "verbose_name_plural": "empresas de supervisión",
            },
        ),
        migrations.AddField(
            model_name="persona",
            name="empresa_contratista",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="superintendentes",
                to="contracts.contratista",
            ),
        ),
        migrations.AddField(
            model_name="persona",
            name="empresa_supervision",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="supervisores",
                to="contracts.empresasupervision",
            ),
        ),
    ]

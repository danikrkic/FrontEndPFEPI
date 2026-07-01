import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0013_contract_montos_originales'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='incumplimiento',
            name='resuelto',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='TerminacionContrato',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('normal', 'Normal'), ('anticipada', 'Anticipada'), ('suspension', 'Suspensión')], max_length=20)),
                ('fecha_terminacion', models.DateField()),
                ('avance_fisico_final', models.DecimalField(decimal_places=2, max_digits=5)),
                ('nota_cierre', models.TextField()),
                ('motivo', models.TextField(blank=True)),
                ('fecha_registro', models.DateField(auto_now_add=True)),
                ('cierre_status', models.CharField(choices=[('registrada', 'Terminación Registrada'), ('acta_entregada', 'Acta Entregada'), ('finiquito_emitido', 'Finiquito Emitido')], default='registrada', max_length=30)),
                ('contrato', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='terminacion', to='contracts.contract')),
                ('registrado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='terminaciones_registradas', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='ActaEntregaRecepcion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_firma', models.DateField()),
                ('archivo', models.FileField(upload_to='actas/')),
                ('fecha_registro', models.DateField(auto_now_add=True)),
                ('terminacion', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='acta', to='contracts.terminacioncontrato')),
                ('registrado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='actas_registradas', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Finiquito',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('estimaciones_pendientes', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('ajuste_precios', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('otros_creditos_contratista', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('saldo_anticipo_no_amortizado', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('penas_convencionales', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('deducibles', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_creditos_contratista', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_creditos_dependencia', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('saldo_neto', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('status', models.CharField(choices=[('borrador', 'Borrador'), ('notificado', 'Notificado'), ('conforme', 'Conforme'), ('inconformidad', 'Con Inconformidad'), ('cerrado', 'Cerrado')], default='borrador', max_length=20)),
                ('fecha_notificacion', models.DateField(blank=True, null=True)),
                ('fecha_limite_respuesta', models.DateField(blank=True, null=True)),
                ('conformidad', models.BooleanField(blank=True, null=True)),
                ('motivo_inconformidad', models.TextField(blank=True)),
                ('fecha_creacion', models.DateField(auto_now_add=True)),
                ('contrato', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='finiquito', to='contracts.contract')),
                ('emitido_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='finiquitos_emitidos', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]

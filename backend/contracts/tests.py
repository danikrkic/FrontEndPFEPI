from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Role
from .models import ConceptoCatalogo, Contract, Contratista, Convenio, Persona

User = get_user_model()


class ConvenioModificatorioTests(APITestCase):
    """Cobertura mínima del flujo de convenio modificatorio (Art. 59 LOPSRM)."""

    def setUp(self):
        contratista = Contratista.objects.create(
            nombre="Constructora Prueba", rfc="CPR010101AAA", representante="Rep",
            telefono="555", correo="c@example.com",
        )
        residente = Persona.objects.create(nombre="Residente", rfc="RES010101AAA", telefono="1", correo="r@example.com")
        supervisor = Persona.objects.create(nombre="Supervisor", rfc="SUP010101AAA", telefono="2", correo="s@example.com")
        superintendente = Persona.objects.create(
            nombre="Superintendente", rfc="SUI010101AAA", telefono="3", correo="si@example.com",
            empresa_contratista=contratista,
        )

        self.contrato = Contract.objects.create(
            no_contrato="TEST-001",
            objeto="Obra de prueba",
            monto=Decimal("1000000.00"),
            monto_original=Decimal("1000000.00"),
            plazo_dias=100,
            plazo_dias_original=100,
            fecha_inicio=date.today(),
            fecha_termino=date.today() + timedelta(days=100),
            contratista=contratista,
            residente=residente,
            supervisor=supervisor,
            superintendente=superintendente,
            status=Contract.Status.ACTIVO,
        )
        self.concepto = ConceptoCatalogo.objects.create(
            contrato=self.contrato, clave="CIM-001", descripcion="Excavación",
            unidad="m3", cantidad=Decimal("100.00"), precio_unitario=Decimal("50.00"),
        )

        self.superintendente_user = User.objects.create_user(
            username="superintendente@test.com", email="superintendente@test.com",
            password="x", role=Role.SUPERINTENDENTE, persona=superintendente,
        )
        self.dependencia_user = User.objects.create_user(
            username="dependencia@test.com", email="dependencia@test.com",
            password="x", role=Role.DEPENDENCIA,
        )

    def _crear_convenio(self, **overrides):
        payload = {
            "contrato_id": self.contrato.id,
            "tipo": Convenio.Tipo.MONTO,
            "justificacion": "Justificación de prueba",
            "monto_adicional": "10000.00",
            "dias_adicionales": 0,
            "alcance": Convenio.Alcance.AJUSTE_MONTO_SIMPLE,
        }
        payload.update(overrides)
        self.client.force_authenticate(user=self.superintendente_user)
        return self.client.post(reverse("convenio-list"), payload, format="json")

    def test_crear_bloqueado_si_contrato_no_activo(self):
        self.contrato.status = Contract.Status.REGISTRADO
        self.contrato.save(update_fields=["status"])
        resp = self._crear_convenio()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_bloqueado_si_convenio_pendiente_duplicado(self):
        resp1 = self._crear_convenio()
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        resp2 = self._crear_convenio()
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_bloqueado_si_excede_25_porciento_monto(self):
        resp = self._crear_convenio(monto_adicional="300000.00")  # 30% > 25%
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_bloqueado_si_excede_25_porciento_plazo(self):
        resp = self._crear_convenio(
            tipo=Convenio.Tipo.PLAZO, monto_adicional="0", dias_adicionales=30,  # 30% > 25%
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_revisar_rechazo_sin_motivo_falla(self):
        resp = self._crear_convenio()
        convenio_id = resp.data["id"]
        self.client.force_authenticate(user=self.dependencia_user)
        resp2 = self.client.post(
            reverse("convenio-revisar", args=[convenio_id]), {"status": "rechazado"}, format="json",
        )
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_revisar_aprobar_excede_25_bloqueado_por_acumulado(self):
        # Primer convenio de 20% se aprueba sin problema.
        resp1 = self._crear_convenio(monto_adicional="200000.00")
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        self.client.force_authenticate(user=self.dependencia_user)
        aprobar1 = self.client.post(
            reverse("convenio-revisar", args=[resp1.data["id"]]), {"status": "aprobado"}, format="json",
        )
        self.assertEqual(aprobar1.status_code, status.HTTP_200_OK)

        # Un segundo convenio de otro 10% ya no cabe (acumulado 30% > 25%).
        resp2 = self._crear_convenio(monto_adicional="100000.00")
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aprobar_ajuste_cantidades_actualiza_catalogo_y_crea_version(self):
        resp = self._crear_convenio(
            tipo=Convenio.Tipo.MONTO,
            monto_adicional="5000.00",
            alcance=Convenio.Alcance.AJUSTE_CANTIDADES,
            conceptos_afectados=[
                {"concepto_id": self.concepto.id, "cantidad_anterior": "100.00", "cantidad_nueva": "150.00"}
            ],
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

        version_previa = self.contrato.version
        self.client.force_authenticate(user=self.dependencia_user)
        aprobar = self.client.post(
            reverse("convenio-revisar", args=[resp.data["id"]]), {"status": "aprobado"}, format="json",
        )
        self.assertEqual(aprobar.status_code, status.HTTP_200_OK, aprobar.data)

        self.concepto.refresh_from_db()
        self.assertEqual(self.concepto.cantidad, Decimal("150.00"))
        self.contrato.refresh_from_db()
        self.assertEqual(self.contrato.version, version_previa + 1)
        self.assertTrue(self.contrato.versiones.filter(version=self.contrato.version).exists())

    def test_metodos_no_permitidos_put_patch_delete(self):
        resp = self._crear_convenio()
        convenio_id = resp.data["id"]
        url = reverse("convenio-detail", args=[convenio_id])
        self.client.force_authenticate(user=self.dependencia_user)
        self.assertEqual(self.client.put(url, {}, format="json").status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.patch(url, {}, format="json").status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

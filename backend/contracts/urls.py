from rest_framework.routers import DefaultRouter

from .views import (
    AnticipoViewSet,
    AvanceDiarioViewSet,
    ContractViewSet,
    ContratistaViewSet,
    ConvenioViewSet,
    EstimacionViewSet,
    GarantiaViewSet,
    IncumplimientoViewSet,
    MinutaViewSet,
    OrdenPagoViewSet,
    PersonaViewSet,
)

router = DefaultRouter()
router.register("contratistas", ContratistaViewSet, basename="contratista")
router.register("personas", PersonaViewSet, basename="persona")
router.register("contratos", ContractViewSet, basename="contrato")
router.register("estimaciones", EstimacionViewSet, basename="estimacion")
router.register("ordenes-pago", OrdenPagoViewSet, basename="orden-pago")
router.register("garantias", GarantiaViewSet, basename="garantia")
router.register("anticipos", AnticipoViewSet, basename="anticipo")
router.register("convenios", ConvenioViewSet, basename="convenio")
router.register("avances", AvanceDiarioViewSet, basename="avance")
router.register("incumplimientos", IncumplimientoViewSet, basename="incumplimiento")
router.register("minutas", MinutaViewSet, basename="minuta")

urlpatterns = router.urls

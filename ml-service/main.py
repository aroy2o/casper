import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from routes.parse import router as parse_router
from routes.audit import router as audit_router
from routes.predictions import router as predictions_router
from routes.estimate import router as estimate_router
from services.price_predictor import retrain_all
from services.cost_estimator import load_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def weekly_retrain() -> None:
    logger.info("Weekly model retrain triggered")
    count = retrain_all()
    logger.info("Weekly retrain complete — %d models updated", count)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up models at startup (non-blocking — runs in background)
    import threading
    threading.Thread(target=retrain_all, daemon=True).start()
    threading.Thread(target=load_models, daemon=True).start()

    scheduler.add_job(weekly_retrain, "interval", weeks=1, id="weekly_retrain", replace_existing=True)
    scheduler.start()
    logger.info("ML scheduler started")
    yield
    scheduler.shutdown(wait=False)
    logger.info("ML scheduler stopped")


app = FastAPI(title="CASPER ML Service", version="2.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, object]:
    return {"success": True, "data": {"status": "ok", "scheduler": scheduler.running}}


app.include_router(parse_router)
app.include_router(audit_router)
app.include_router(predictions_router)
app.include_router(estimate_router)

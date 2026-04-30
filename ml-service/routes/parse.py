from fastapi import APIRouter
from models.schemas import ParseRequest, ParseResponse
from services.pdf_parser import parse_pdf

router = APIRouter(prefix="/parse", tags=["parse"])


@router.post("", response_model=ParseResponse)
def parse_endpoint(payload: ParseRequest) -> ParseResponse:
    line_items = parse_pdf(payload.filePath)
    return ParseResponse(lineItems=line_items)

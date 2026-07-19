from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.symptom import SymptomItem, SymptomListResponse

router = APIRouter()

SYMPTOMS = [
    SymptomItem(
        id=1,
        name="无法上电",
        description="设备接通电源后没有任何响应",
    ),
    SymptomItem(
        id=2,
        name="电压或电流异常",
        description="测量值明显高于或低于设计范围",
    ),
    SymptomItem(
        id=3,
        name="通信失败或乱码",
        description="串口、I²C、SPI 等通信无法建立或数据错误",
    ),
]


@router.get("/symptoms", response_model=SymptomListResponse)
def list_symptoms(
    keyword: Annotated[
        str | None,
        Query(
            min_length=2,
            max_length=20,
            description="搜索故障名称或描述",
        ),
    ] = None,
) -> SymptomListResponse:
    if keyword is None:
        filtered_symptoms = SYMPTOMS
    else:
        normalized_keyword = keyword.casefold()
        filtered_symptoms = [
            symptom
            for symptom in SYMPTOMS
            if normalized_keyword in symptom.name.casefold()
            or normalized_keyword in symptom.description.casefold()
        ]

    return SymptomListResponse(
        items=filtered_symptoms,
        total=len(filtered_symptoms),
    )


@router.get("/symptoms/{symptom_id}", response_model=SymptomItem)
def get_symptom(symptom_id: int) -> SymptomItem:
    for symptom in SYMPTOMS:
        if symptom.id == symptom_id:
            return symptom

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="故障现象不存在",
    )

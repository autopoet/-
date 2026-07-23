import json
from datetime import datetime

from app.core.config import settings
from app.core.security import hash_password
from app.db.database import database
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User

DEFAULT_SYMPTOMS = (
    {"name": "无法上电", "description": "设备接通电源后没有任何响应"},
    {"name": "电压或电流异常", "description": "测量值明显高于或低于设计范围"},
    {
        "name": "通信失败或乱码",
        "description": "串口、I²C、SPI 等通信无法建立或数据错误",
    },
)

DEMO_SYMPTOM = {
    "name": "稳压电源带负载后输出电压骤降",
    "description": "空载输出正常，接入负载后电压明显下降、反复重启或进入限流保护",
}
DEMO_EDIT_SUMMARY = "初始化真实排障示例"
DEMO_CHECKLIST = [
    "断开负载，确认稳压电源空载输出是否正常",
    "测量输入端电压，排除前级电源或导线压降",
    "逐步增加负载，确认电压开始下降时的实际电流",
    "检查限流值、散热与输入输出压差是否满足要求",
    "修复后分别在空载、额定负载和动态负载下复测",
]


def _text(value: str) -> dict:
    return {"type": "text", "text": value}


def _paragraph(value: str) -> dict:
    return {"type": "paragraph", "content": [_text(value)]}


def _heading(value: str) -> dict:
    return {"type": "heading", "attrs": {"level": 2}, "content": [_text(value)]}


DEMO_BODY = {
    "type": "doc",
    "content": [
        _heading("现象与判断边界"),
        _paragraph(
            "稳压电源空载输出正常，接入负载后电压明显下降，负载可能反复复位。"
            "先不要直接更换稳压芯片，应确认问题来自输入压降、限流、器件压差还是散热。"
        ),
        _heading("快速检查"),
        {
            "type": "bulletList",
            "content": [
                {"type": "listItem", "content": [_paragraph(item)]}
                for item in (
                    "同时测量稳压器输入端和输出端，不要只看电源面板读数。",
                    "逐步增加负载，记录电压开始下降时的电流。",
                    "检查输入输出电容的容量、ESR、极性和回流路径。",
                )
            ],
        },
        _heading("分步排查"),
        _paragraph("1. 输入端同步掉压：检查供电能力、连接器、导线和保护器件。"),
        _paragraph("2. 输入正常但输出下降：对照数据手册核对 dropout、电流限制与结温。"),
        {
            "type": "codeBlock",
            "attrs": {"language": "text"},
            "content": [_text("P_LDO = (Vin - Vout) × Iload")],
        },
        _paragraph("3. 输出周期性恢复：使用示波器观察输出波形，判断是否进入过流或过温保护。"),
        _heading("修复验证"),
        {
            "type": "blockquote",
            "content": [
                _paragraph(
                    "修复后至少连续运行十分钟，并在空载、额定负载和负载阶跃三种条件下"
                    "记录输入电压、输出电压、电流与器件温升。"
                )
            ],
        },
    ],
}


def _ensure_user(username: str, password: str, role: str) -> User:
    user = User.get_or_none(User.username == username)
    if user is None:
        return User.create(username=username, password_hash=hash_password(password), role=role)
    if user.role != role:
        user.role = role
        user.save(only=[User.role])
    return user


def _ensure_demo_symptom() -> Symptom:
    defaults: dict[str, object] = {"description": DEMO_SYMPTOM["description"]}
    if "is_published" in Symptom._meta.fields:
        defaults["is_published"] = True
    symptom, _ = Symptom.get_or_create(name=DEMO_SYMPTOM["name"], defaults=defaults)

    changes: dict[str, object] = {}
    if symptom.description != DEMO_SYMPTOM["description"]:
        changes["description"] = DEMO_SYMPTOM["description"]
    if "is_published" in Symptom._meta.fields and not symptom.is_published:
        changes["is_published"] = True
    if changes:
        Symptom.update(**changes).where(Symptom.id == symptom.id).execute()
        symptom = Symptom.get_by_id(symptom.id)
    return symptom


def seed_demo_data(
    reviewer_username: str,
    reviewer_password: str,
    contributor_username: str,
    contributor_password: str,
) -> ArticleRevision:
    """幂等创建本地演示用户和一篇已审核发布的真实文章。"""
    now = datetime.now()
    with database.atomic():
        reviewer = _ensure_user(reviewer_username, reviewer_password, "reviewer")
        contributor = _ensure_user(contributor_username, contributor_password, "contributor")
        symptom = _ensure_demo_symptom()
        revision = ArticleRevision.get_or_none(
            (ArticleRevision.symptom == symptom)
            & (ArticleRevision.author == contributor)
            & (ArticleRevision.edit_summary == DEMO_EDIT_SUMMARY)
        )
        if revision is None:
            revision = ArticleRevision.create(
                symptom=symptom,
                author=contributor,
                reviewer=reviewer,
                version_number=1,
                status="approved",
                title="稳压电源空载正常，带负载后输出电压骤降",
                summary=DEMO_SYMPTOM["description"],
                applicability="适用于低压直流供电中的 LDO、降压模块和实验电源。",
                safety="改线、测量电阻或重新焊接前必须断电；测量时避免探头造成输出短路。",
                checklist_json=json.dumps(DEMO_CHECKLIST, ensure_ascii=False),
                body=json.dumps(DEMO_BODY, ensure_ascii=False),
                edit_summary=DEMO_EDIT_SUMMARY,
                review_note="排查顺序明确，测量条件和修复验证完整。",
                submitted_at=now,
                reviewed_at=now,
                published_at=now,
            )
        return revision


def main() -> None:
    from app.db.bootstrap import bootstrap_database

    bootstrap_database()
    with database.connection_context():
        revision = seed_demo_data(
            reviewer_username=settings.seed_reviewer_username,
            reviewer_password=settings.seed_reviewer_password,
            contributor_username=settings.seed_contributor_username,
            contributor_password=settings.seed_contributor_password,
        )
    print(
        f"Seed 完成：文章 #{revision.symptom_id}《{revision.title}》；"
        f"审核员 {settings.seed_reviewer_username}；贡献者 {settings.seed_contributor_username}"
    )


if __name__ == "__main__":
    main()

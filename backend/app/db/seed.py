import json
from datetime import datetime

from peewee import fn

from app.core.config import settings
from app.core.security import hash_password
from app.db.database import database
from app.models.article_revision import ArticleRevision
from app.models.symptom import Symptom
from app.models.user import User

GUIDE_SYMPTOM = {
    "name": "本站使用指南",
    "description": "了解如何查找排障文档、贡献经验、参与审核与评论",
}
GUIDE_EDIT_SUMMARY = "初始化本站使用指南"
GUIDE_CHECKLIST = [
    "游客可以直接阅读公开文档",
    "登录后可以收藏、评论和贡献内容",
    "新建或修改的正文经审核后才会公开",
    "遇到错误或危险内容时请提醒维护者处理",
]


def _text(value: str) -> dict:
    return {"type": "text", "text": value}


def _paragraph(value: str) -> dict:
    return {"type": "paragraph", "content": [_text(value)]}


def _heading(value: str) -> dict:
    return {"type": "heading", "attrs": {"level": 2}, "content": [_text(value)]}


def _list_item(value: str) -> dict:
    return {"type": "listItem", "content": [_paragraph(value)]}


GUIDE_BODY = {
    "type": "doc",
    "content": [
        _heading("先从这里开始"),
        _paragraph(
            "电赛白皮书是一座由参赛者共同维护的公开 Debug 知识库。"
            "每篇文档都应从可观察的故障现象出发，给出可以执行、测量和复核的排查过程。"
        ),
        _heading("查找一篇排障文档"),
        {
            "type": "orderedList",
            "content": [
                _list_item("描述你看到的现象、器件或错误信息，而不是先猜测故障原因。"),
                _list_item("进入文档后先核对适用范围、安全提示和所需测量条件。"),
                _list_item("按快速检查清单和正文顺序记录测量值，不要跳过验证步骤。"),
                _list_item("问题解决后选择“解决了”；仍有疑问时可对具体文字发起评论。"),
            ],
        },
        _heading("贡献自己的经验"),
        {
            "type": "bulletList",
            "content": [
                _list_item("注册并登录后，可以新建条目或在当前文档内直接编辑。"),
                _list_item("新文章可一键插入标准排障模板，再按实际情况增删章节。"),
                _list_item("保存草稿不会公开；填写修改说明并提交后才会进入审核队列。"),
                _list_item("待审核版本可以撤回继续修改，从未提交的草稿可以直接删除。"),
            ],
        },
        {
            "type": "codeBlock",
            "attrs": {"language": "text"},
            "content": [_text("故障现象 → 测量条件 → 排查步骤 → 预期结果 → 根因 → 修复验证")],
        },
        _heading("审核与版本"),
        _paragraph(
            "所有新增和修改都要经过审核才会改变公开内容。审核员看到的是人类可读的"
            "块级差异；通过、驳回、撤回和回滚都会保留修改者、审核者与日期。"
        ),
        {
            "type": "blockquote",
            "content": [
                _paragraph(
                    "审核通过只表示内容结构和依据达到发布要求，不等于每一种硬件环境都已复现。"
                    "引用结论前仍应核对器件型号、供电、负载、固件和仪器条件。"
                )
            ],
        },
        _heading("评论与通知"),
        _paragraph(
            "阅读时选中一段文字即可发起划线评论。回复会留在原文上下文中；"
            "新内容待审核、自己的投稿结果和评论回复会通过站内通知提醒相关用户。"
        ),
        _heading("写作约定"),
        {
            "type": "bulletList",
            "content": [
                _list_item("记录真实测量条件、仪器、数值和预期结果。"),
                _list_item("区分已经验证的结论、合理推测和仍待确认的问题。"),
                _list_item("涉及市电、高压、大电流、电池或激光时明确写出安全边界。"),
                _list_item("尊重原作者与资料许可，引用数据手册或外部资料时注明来源。"),
            ],
        },
    ],
}


def _ensure_user(username: str, password: str, role: str) -> User:
    if (
        role == "admin"
        and User.select().where((User.role == "admin") & (User.username != username)).exists()
    ):
        role = "reviewer"
    user = User.get_or_none(User.username == username)
    if user is None:
        return User.create(username=username, password_hash=hash_password(password), role=role)
    if user.role != role:
        user.role = role
        user.save(only=[User.role])
    return user


def _ensure_guide_symptom() -> Symptom:
    symptom, _ = Symptom.get_or_create(
        name=GUIDE_SYMPTOM["name"],
        defaults={
            "description": GUIDE_SYMPTOM["description"],
            "is_published": True,
        },
    )
    changes: dict[str, object] = {}
    if symptom.description != GUIDE_SYMPTOM["description"]:
        changes["description"] = GUIDE_SYMPTOM["description"]
    if not symptom.is_published:
        changes["is_published"] = True
    if changes:
        Symptom.update(**changes).where(Symptom.id == symptom.id).execute()
        symptom = Symptom.get_by_id(symptom.id)
    return symptom


def seed_site_guide(
    reviewer_username: str,
    reviewer_password: str,
    contributor_username: str,
    contributor_password: str,
) -> ArticleRevision:
    """幂等创建本地演示账号和一篇已发布的本站使用指南。"""
    now = datetime.now()
    with database.atomic():
        seed_reviewer = _ensure_user(reviewer_username, reviewer_password, "admin")
        _ensure_user(contributor_username, contributor_password, "contributor")
        admin = User.select().where(User.role == "admin").order_by(User.id).first()
        guide_owner = admin or seed_reviewer
        symptom = _ensure_guide_symptom()
        revision = ArticleRevision.get_or_none(
            (ArticleRevision.symptom == symptom)
            & (ArticleRevision.edit_summary == GUIDE_EDIT_SUMMARY)
        )
        if revision is None:
            version_number = (
                ArticleRevision.select(fn.COALESCE(fn.MAX(ArticleRevision.version_number), 0) + 1)
                .where(ArticleRevision.symptom == symptom)
                .scalar()
            )
            revision = ArticleRevision.create(
                symptom=symptom,
                author=guide_owner,
                reviewer=guide_owner,
                version_number=version_number,
                status="approved",
                origin="official_seed",
                title=GUIDE_SYMPTOM["name"],
                summary=GUIDE_SYMPTOM["description"],
                applicability="适用于第一次访问本站的读者、贡献者和审核员。",
                safety="",
                checklist_json=json.dumps(GUIDE_CHECKLIST, ensure_ascii=False),
                body=json.dumps(GUIDE_BODY, ensure_ascii=False),
                edit_summary=GUIDE_EDIT_SUMMARY,
                review_note="本站默认功能示例文档。",
                submitted_at=now,
                reviewed_at=now,
                published_at=now,
            )
        return revision


def main() -> None:
    from app.db.bootstrap import bootstrap_database

    bootstrap_database()
    with database.connection_context():
        revision = seed_site_guide(
            reviewer_username=settings.seed_reviewer_username,
            reviewer_password=settings.seed_reviewer_password,
            contributor_username=settings.seed_contributor_username,
            contributor_password=settings.seed_contributor_password,
        )
    print(
        f"Seed 完成：文章 #{revision.symptom_id}《{revision.title}》；"
        f"审核账号 {settings.seed_reviewer_username}；"
        f"贡献者 {settings.seed_contributor_username}"
    )


if __name__ == "__main__":
    main()

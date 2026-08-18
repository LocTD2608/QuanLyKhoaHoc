import pytest
from services.rag_chatbot.journal_scoring.engine import calculate_weighted_author_score

def test_scoring_engine():
    # Trường hợp 1: Bài báo có 4 tác giả, ứng viên là tác giả đầu, 
    # có tác giả liên hệ riêng biệt.
    # Max score = 2.0.
    # num_main_authors = 2 (tác giả đầu + tác giả liên hệ)
    # Quỹ chính = 2.0 * 1/3 = 0.6667, chia 2 = 0.3333
    # Quỹ chung = 2.0 * 2/3 = 1.3333, chia 4 = 0.3333
    # Tổng điểm = 0.33 + 0.33 = 0.67 (tròn 2 chữ số)
    res1 = calculate_weighted_author_score(
        max_score=2.0,
        total_authors=4,
        is_first_author=True,
        is_corresponding_author=False,
        has_distinct_corresponding_author=True
    )
    assert res1["data"]["user_score"] == 0.67
    assert res1["data"]["calculation_breakdown"]["num_main_authors"] == 2
    assert res1["data"]["calculation_breakdown"]["total_authors"] == 4

    # Trường hợp 2: Bài báo có 1 tác giả duy nhất.
    # Max score = 2.0.
    # num_main_authors = 1
    # Quỹ chính = 2.0 * 1/3 = 0.6667
    # Quỹ chung = 2.0 * 2/3 = 1.3333
    # Tổng điểm = 0.67 + 1.33 = 2.0
    res2 = calculate_weighted_author_score(
        max_score=2.0,
        total_authors=1,
        is_first_author=True,
        is_corresponding_author=True,
        has_distinct_corresponding_author=False
    )
    assert res2["data"]["user_score"] == 2.0
    assert res2["data"]["calculation_breakdown"]["num_main_authors"] == 1

    # Trường hợp 3: Ứng viên là thành viên thông thường (không phải tg đầu, không phải tg lh)
    # Bài báo 4 tác giả, có tác giả liên hệ riêng biệt.
    # Quỹ chính = 0 (vì không phải tác giả chính)
    # Quỹ chung = 2.0 * 2/3 = 1.3333, chia 4 = 0.3333
    # Tổng điểm = 0.33
    res3 = calculate_weighted_author_score(
        max_score=2.0,
        total_authors=4,
        is_first_author=False,
        is_corresponding_author=False,
        has_distinct_corresponding_author=True
    )
    assert res3["data"]["user_score"] == 0.33
    assert res3["data"]["calculation_breakdown"]["user_main_pool_share"] == 0.0
    assert res3["data"]["calculation_breakdown"]["user_global_pool_share"] == 0.33

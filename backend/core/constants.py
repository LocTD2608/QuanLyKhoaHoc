"""
core/constants.py — Hằng số hệ thống, danh mục chuẩn và danh sách custom venues.
"""

from typing import List, Dict, Any

CUSTOM_VENUES: List[Dict[str, Any]] = [
    {
        "name": "International Conference on Machine Learning (ICML)",
        "category_enum": "CONFERENCE_INTL_PRESTIGIOUS",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "Neural Information Processing Systems (NeurIPS)",
        "category_enum": "CONFERENCE_INTL_PRESTIGIOUS",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)",
        "category_enum": "CONFERENCE_INTL_PRESTIGIOUS",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "International Conference on Very Large Data Bases (VLDB)",
        "category_enum": "CONFERENCE_INTL_PRESTIGIOUS",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "ACM SIGKDD Conference on Knowledge Discovery and Data Mining (KDD)",
        "category_enum": "CONFERENCE_INTL_PRESTIGIOUS",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "International Conference on Knowledge and Systems Engineering (KSE)",
        "category_enum": "CONFERENCE_INTL_SPECIALIZED",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "IEEE-RIVF International Conference on Computing and Communication Technologies (RIVF)",
        "category_enum": "CONFERENCE_INTL_SPECIALIZED",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "International Conference on Advanced Technologies for Communications (ATC)",
        "category_enum": "CONFERENCE_INTL_SPECIALIZED",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "IEEE International Conference on Network Infrastructure and Digital Content (IC-NIDC)",
        "category_enum": "CONFERENCE_INTL_SPECIALIZED",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "Hội nghị Quốc gia về Nghiên cứu cơ bản và ứng dụng Công nghệ thông tin (FAIR)",
        "category_enum": "CONFERENCE_DOMESTIC_MINISTRY",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "Hội thảo Quốc gia Một số vấn đề chọn lọc của Công nghệ thông tin và Truyền thông",
        "category_enum": "CONFERENCE_DOMESTIC_MINISTRY",
        "field": "Công nghệ thông tin"
    },
    {
        "name": "Hội nghị khoa học trẻ học đường về CNTT Học viện Bưu chính Viễn thông",
        "category_enum": "CONFERENCE_DOMESTIC_UNIVERSITY",
        "field": "Công nghệ thông tin"
    }
]

import * as React from 'react';
import { useState } from 'react';

interface PubType {
  id: string;
  name: string;
  category: string;
  points: number;
  description: string;
}

export const PUBLICATION_TYPES: PubType[] = [
  // Bài báo quốc tế
  { id: 'intl_q1', name: 'Bài báo ISI/Scopus Q1', category: 'Bài báo quốc tế', points: 2.0, description: 'Có ISSN và thuộc danh mục ISI / SCIE / Scopus' },
  { id: 'intl_q2', name: 'Bài báo ISI/Scopus Q2', category: 'Bài báo quốc tế', points: 1.5, description: 'Có ISSN và thuộc danh mục ISI / SCIE / Scopus' },
  { id: 'intl_q3', name: 'Bài báo ISI/Scopus Q3', category: 'Bài báo quốc tế', points: 1.25, description: 'Có ISSN và thuộc danh mục ISI / SCIE / Scopus' },
  { id: 'intl_q4', name: 'Bài báo ISI/Scopus Q4', category: 'Bài báo quốc tế', points: 1.0, description: 'Có ISSN và thuộc danh mục ISI / SCIE / Scopus' },
  // Bài báo quốc tế khác
  { id: 'intl_other_online', name: 'Bài báo quốc tế khác (Online)', category: 'Bài báo quốc tế khác', points: 1.0, description: 'Có ISSN, không thuộc ISI/Scopus, xuất bản online' },
  { id: 'intl_other_offline', name: 'Bài báo quốc tế khác (Offline)', category: 'Bài báo quốc tế khác', points: 0.75, description: 'Có ISSN, không thuộc ISI/Scopus, không xuất bản online' },
  // Bài báo trong nước
  { id: 'dom_a', name: 'Tạp chí trong nước loại A', category: 'Bài báo trong nước', points: 1.0, description: 'Tạp chí khoa học uy tín cao được HĐGS ngành xác định' },
  { id: 'dom_b', name: 'Tạp chí trong nước loại B', category: 'Bài báo trong nước', points: 0.5, description: 'Tạp chí khoa học uy tín thuộc danh mục HĐGSNN' },
  // Kỷ yếu hội nghị
  { id: 'conf_wos', name: 'Kỷ yếu quốc tế uy tín (Scopus/WoS)', category: 'Kỷ yếu hội nghị', points: 1.0, description: 'Kỷ yếu hội nghị quốc tế có phản biện, xuất bản có mã số ISBN' },
  { id: 'conf_intl', name: 'Kỷ yếu quốc tế chuyên ngành', category: 'Kỷ yếu hội nghị', points: 0.75, description: 'Hội nghị quốc tế chuyên ngành có phản biện & ISBN' },
  { id: 'conf_small', name: 'Kỷ yếu hội nghị quốc tế nhỏ', category: 'Kỷ yếu hội nghị', points: 0.5, description: 'Hội nghị quốc tế quy mô nhỏ có phản biện & ISBN' },
  { id: 'conf_national_key', name: 'Kỷ yếu cấp Bộ / Trường trọng điểm', category: 'Kỷ yếu hội nghị', points: 0.5, description: 'Hội nghị trong nước cấp Bộ hoặc trường trọng điểm' },
  { id: 'conf_univ', name: 'Kỷ yếu hội nghị cấp trường', category: 'Kỷ yếu hội nghị', points: 0.4, description: 'Hội nghị khoa học trong nước cấp trường đại học' },
  { id: 'conf_faculty', name: 'Kỷ yếu hội nghị cấp khoa', category: 'Kỷ yếu hội nghị', points: 0.3, description: 'Hội nghị/hội thảo khoa học cấp khoa/phòng' },
  // Sách đào tạo
  { id: 'book_monograph', name: 'Sách chuyên khảo', category: 'Sách phục vụ đào tạo', points: 3.0, description: 'Sách chuyên khảo phục vụ đào tạo, có phản biện, tác giả chính' },
  { id: 'book_curriculum', name: 'Giáo trình (Đại học, Sau ĐH)', category: 'Sách phục vụ đào tạo', points: 2.0, description: 'Giáo trình giảng dạy được thẩm định và xuất bản' },
  { id: 'book_ref', name: 'Sách tham khảo', category: 'Sách phục vụ đào tạo', points: 1.5, description: 'Sách tham khảo phục vụ đào tạo' },
  { id: 'book_guide', name: 'Sách hướng dẫn / Từ điển', category: 'Sách phục vụ đào tạo', points: 1.0, description: 'Sách hướng dẫn học tập, từ điển chuyên ngành' },
  { id: 'book_chapter', name: 'Chương sách (NXB quốc tế uy tín)', category: 'Sách phục vụ đào tạo', points: 1.0, description: 'Viết chương sách xuất bản bởi NXB quốc tế uy tín' },
  // Kết quả ứng dụng KH&CN
  { id: 'tech_patent', name: 'Bằng độc quyền sáng chế', category: 'Kết quả ứng dụng KH&CN', points: 3.0, description: 'Được Cục Sở hữu trí tuệ cấp, tùy mức độ bảo hộ & ứng dụng' },
  { id: 'tech_solution', name: 'Giải pháp hữu ích', category: 'Kết quả ứng dụng KH&CN', points: 2.0, description: 'Được Cục Sở hữu trí tuệ cấp bằng độc quyền giải pháp hữu ích' },
  // Tác phẩm nghệ thuật / TDTT
  { id: 'art_intl', name: 'Giải thưởng nghệ thuật / TDTT quốc tế', category: 'Tác phẩm nghệ thuật / TDTT', points: 1.5, description: 'Giải thưởng lớn đạt cấp quốc tế được công nhận' },
  { id: 'art_national', name: 'Giải thưởng nghệ thuật / TDTT quốc gia', category: 'Tác phẩm nghệ thuật / TDTT', points: 1.0, description: 'Giải thưởng lớn đạt cấp quốc gia được công nhận' },
];

export const PointsCalculatorTab: React.FC = () => {
  const [calcPubId, setCalcPubId] = useState<string>('intl_q1');
  const [calcNumAuthors, setCalcNumAuthors] = useState<number>(3);
  const [calcRole, setCalcRole] = useState<'main' | 'member' | 'equal'>('main');
  const [calcIfBonus, setCalcIfBonus] = useState<boolean>(false);
  const [calcIntlPubBonus, setCalcIntlPubBonus] = useState<boolean>(false);
  const [calculatedPoints, setCalculatedPoints] = useState({
    basePoints: 2.0,
    bonusPoints: 0,
    totalPubPoints: 2.0,
    candidatePoints: 1.11,
    formulaText: 'Tác giả chính: 1/3 tổng điểm + 2/3 tổng điểm chia đều cho 3 tác giả.',
  });

  const categories = Array.from(new Set(PUBLICATION_TYPES.map((p) => p.category)));

  const handleCalculate = (
    pubId: string,
    numAuthors: number,
    role: 'main' | 'member' | 'equal',
    ifBonus: boolean,
    intlPubBonus: boolean
  ) => {
    const selectedPub = PUBLICATION_TYPES.find((p) => p.id === pubId);
    if (!selectedPub) return;

    let base = selectedPub.points;
    let bonus = 0;

    if (ifBonus && selectedPub.category.includes('Bài báo quốc tế')) {
      if (selectedPub.id === 'intl_q1' || selectedPub.id === 'intl_q2') {
        bonus += 1.0;
      } else {
        bonus += 0.5;
      }
    }

    if (intlPubBonus && selectedPub.category === 'Sách phục vụ đào tạo') {
      bonus += base * 0.25;
    }

    const totalPubPoints = base + bonus;
    let candidatePoints = 0;
    let formulaText = '';
    const safeN = numAuthors > 0 ? numAuthors : 1;

    if (safeN === 1) {
      candidatePoints = totalPubPoints;
      formulaText = 'Ứng viên là tác giả độc nhất: Nhận trọn vẹn 100% điểm công trình quy đổi.';
    } else {
      if (role === 'main') {
        candidatePoints = totalPubPoints / 3 + (2 * totalPubPoints) / (3 * safeN);
        formulaText = `Tác giả chính: Nhận 1/3 điểm công trình (${(totalPubPoints / 3).toFixed(2)}đ), phần còn lại (${((2 * totalPubPoints) / 3).toFixed(2)}đ) chia đều cho tất cả ${safeN} tác giả.`;
      } else if (role === 'member') {
        candidatePoints = ((2 * totalPubPoints) / 3) / safeN;
        formulaText = `Đồng tác giả: Phần còn lại 2/3 điểm công trình (${((2 * totalPubPoints) / 3).toFixed(2)}đ) sau khi trừ phần tác giả chính được chia đều cho ${safeN} tác giả.`;
      } else {
        candidatePoints = totalPubPoints / safeN;
        formulaText = `Không phân định tác giả chính: Tổng điểm công trình (${totalPubPoints.toFixed(2)}đ) chia đều cho ${safeN} tác giả.`;
      }
    }

    setCalculatedPoints({
      basePoints: base,
      bonusPoints: bonus,
      totalPubPoints: totalPubPoints,
      candidatePoints: parseFloat(candidatePoints.toFixed(2)),
      formulaText: formulaText,
    });
  };

  const updateCalculatorField = (field: string, value: any) => {
    let nextPubId = calcPubId;
    let nextNumAuthors = calcNumAuthors;
    let nextRole = calcRole;
    let nextIfBonus = calcIfBonus;
    let nextIntlPubBonus = calcIntlPubBonus;

    if (field === 'pubId') {
      nextPubId = value;
      setCalcPubId(value);
      const pub = PUBLICATION_TYPES.find((p) => p.id === value);
      if (pub) {
        if (!pub.category.includes('Bài báo quốc tế')) nextIfBonus = false;
        if (pub.category !== 'Sách phục vụ đào tạo') nextIntlPubBonus = false;
      }
    } else if (field === 'numAuthors') {
      const parsed = Math.max(1, parseInt(value) || 1);
      nextNumAuthors = parsed;
      setCalcNumAuthors(parsed);
      if (parsed === 1) {
        nextRole = 'main';
        setCalcRole('main');
      }
    } else if (field === 'role') {
      nextRole = value;
      setCalcRole(value);
    } else if (field === 'ifBonus') {
      nextIfBonus = value;
      setCalcIfBonus(value);
    } else if (field === 'intlPubBonus') {
      nextIntlPubBonus = value;
      setCalcIntlPubBonus(value);
    }

    handleCalculate(nextPubId, nextNumAuthors, nextRole, nextIfBonus, nextIntlPubBonus);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
      {/* Point Matrix */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.25rem 0' }}>
          <i className="fa-solid fa-table-list" style={{ color: '#4f46e5' }} /> Danh mục quy đổi điểm công trình khoa học tối đa
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {categories.map((cat) => (
            <div key={cat}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', borderLeft: '3px solid #4f46e5', paddingLeft: '0.5rem' }}>
                {cat}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {PUBLICATION_TYPES.filter((p) => p.category === cat).map((pub) => (
                  <div
                    key={pub.id}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{pub.name}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{pub.description}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '45px' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#4f46e5' }}>{pub.points.toFixed(2)}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Điểm tối đa</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Calculator */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1', padding: '1.5rem', alignSelf: 'start', position: 'sticky', top: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
          <i className="fa-solid fa-calculator" style={{ color: '#4f46e5' }} /> Trình tính điểm quy đổi nhanh
        </h3>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
          Tự động phân chia điểm theo vị trí tác giả và thặng số quy định HĐGSNN.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Loại công trình khoa học</label>
            <select
              value={calcPubId}
              onChange={(e) => updateCalculatorField('pubId', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', outline: 'none', background: 'white' }}
            >
              {PUBLICATION_TYPES.map((p) => (
                <option key={p.id} value={p.id}>{p.category} - {p.name} ({p.points.toFixed(2)}đ)</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Tổng số tác giả</label>
            <input
              type="number"
              min={1}
              value={calcNumAuthors}
              onChange={(e) => updateCalculatorField('numAuthors', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', outline: 'none' }}
            />
          </div>

          {calcNumAuthors > 1 && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Vai trò ứng viên</label>
              <select
                value={calcRole}
                onChange={(e) => updateCalculatorField('role', e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '100%', outline: 'none', background: 'white' }}
              >
                <option value="main">Tác giả chính (First / Corresponding Author)</option>
                <option value="member">Đồng tác giả (Co-author)</option>
                <option value="equal">Không phân định tác giả chính (Chia đều)</option>
              </select>
            </div>
          )}

          {/* Result Card */}
          <div style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#312e81', fontWeight: 600 }}>Điểm nhận quy đổi của bạn:</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4f46e5' }}>{calculatedPoints.candidatePoints.toFixed(2)}đ</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#3730a3', background: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #c7d2fe', marginTop: '0.75rem', lineHeight: 1.4 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }} />
              {calculatedPoints.formulaText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

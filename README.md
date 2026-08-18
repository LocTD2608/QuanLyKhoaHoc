2. Module: Giám định & Xác thực công trình khoa học (Entity Resolution & Validation)
Mục tiêu: Tự động kiểm tra tính chính danh, phân hạng tạp chí và vai trò của ứng viên dựa trên mã DOI hoặc Link bài báo do người dùng cung cấp.
Các Issue chi tiết & Giải pháp:
Rào cản truy cập & Hợp nhất nguồn (Multi-source Data Merging):
Vấn đề: Link bài báo có thể bị chặn bởi tường lửa (Elsevier, Springer), trong khi mã DOI có thể truy cập qua API nhưng dữ liệu Metadata (Crossref/Scopus) đôi khi bị thiếu thông tin về "Tác giả liên hệ" (Corresponding Author).
Giải pháp: Ưu tiên sử dụng API chính thống (Scopus/Web of Science) thông qua mã DOI để lấy Metadata chuẩn. Nếu dữ liệu thiếu, hệ thống tự động kích hoạt Headless Browser (Selenium/Playwright) kết hợp Proxy xoay vòng để truy cập trực tiếp vào Link bài báo, bóc tách sâu (Scraping) phần thông tin chi tiết (Affiliation, Contribution).
Xác thực vai trò tác giả (Author Disambiguation):
Vấn đề: Ứng viên khai báo là tác giả chính, nhưng trong bài báo quốc tế có nhiều tác giả. Việc xác định ai là người có đóng góp cao nhất cần sự chính xác tuyệt đối.
Giải pháp: AI thực hiện trích xuất vị trí tên và các ký hiệu đặc biệt (như dấu sao *, dấu thập †) từ trang web bài báo để xác nhận vai trò: Tác giả thứ nhất (First Author) hay Tác giả liên hệ (Corresponding Author).
Giám định tính liêm chính & Phân hạng (Data Integrity & Ranking):
Vấn đề: Thông tin khai báo sai lệch (Ví dụ: Tạp chí đã bị loại khỏi danh mục Scopus/ISI nhưng ứng viên vẫn khai là bài báo quốc tế uy tín).
Giải pháp: Xây dựng Logic Engine đối soát Metadata thu được với Cơ sở dữ liệu của Hội đồng Giáo sư Nhà nước và các danh sách "Blacklist" (Predatory Journals). Sử dụng Fuzzy String Matching để xử lý sự khác biệt giữa tiêu đề tiếng Anh (từ DOI) và tiêu đề tiếng Việt (ứng viên tự dịch).



. Nhóm Thu thập dữ liệu (Data Collection & Scraping)
Vấn đề: Cấu trúc HTML của tạp chí thay đổi (Brittle Scrapers) Các nhà xuất bản thường xuyên cập nhật UI. Nếu bạn dùng Selenium/Playwright bóc tách dựa trên XPath hoặc CSS Selector cố định, hệ thống sẽ gãy liên tục, đòi hỏi bảo trì khổng lồ.

Giải pháp: Thay vì dùng rule-based scraping, hãy kết hợp LLM (như mô hình bạn đang dùng cho RAG) để trích xuất thông tin. Truyền toàn bộ HTML (sau khi đã dọn dẹp các thẻ nhiễu) vào prompt để AI tự trích xuất "Author", "Affiliation", "Contributions" dưới định dạng JSON, giúp hệ thống chống chịu tốt với sự thay đổi giao diện.

Vấn đề: Hệ thống Anti-bot nâng cao (Cloudflare, CAPTCHA)
Các trang như ResearchGate, Elsevier có hệ thống chống bot rất mạnh. Dù dùng Headless Browser và Proxy xoay vòng, tỷ lệ bị chặn vẫn có thể lên tới 30-50%.

Giải pháp: Chuẩn bị sẵn cơ chế dự phòng thứ 3. Nếu API thất bại và Browser bị chặn, có thể tích hợp các dịch vụ bypass chuyên dụng hoặc yêu cầu ứng viên upload trực tiếp file PDF của bài báo để hệ thống dùng công cụ bóc tách PDF (PDF parser) quét metadata nội bộ của file.

2. Nhóm Xác thực tác giả (Author Disambiguation & Roles)
Vấn đề: Xung đột "Đồng tác giả chính" (Equal Contribution / Co-first Authors)
Rất nhiều bài báo hiện nay có 2-3 tác giả đóng góp ngang nhau (đều được đánh dấu sao * hoặc chú thích "These authors contributed equally"). Nếu chỉ tìm người đứng đầu danh sách (First Author) theo logic thông thường, sẽ đánh rớt oan các ứng viên là Co-first.

Giải pháp: Train AI/Regex để quét và hiểu cụm từ chú thích (Footnotes) về mức độ đóng góp ngang bằng, từ đó gán cờ Is_CoFirst = True.

Vấn đề: Nhận diện sai tên do định dạng (Name Format & Homonyms)
Tên người Việt trên tạp chí quốc tế rất lộn xộn (VD: Nguyễn Văn A có thể là Nguyen Van A, V. A. Nguyen, Nguyen V.A.). Fuzzy matching có thể nhận diện nhầm với một "Nguyễn Văn A" khác thuộc trường đại học khác.

Giải pháp: Phải đối chiếu chéo (Cross-check) với ORCID ID hoặc Affiliation (Cơ quan công tác) tại thời điểm xuất bản bài báo. Nếu tên khớp nhưng Affiliation trên bài báo không trùng với lịch sử công tác của ứng viên, hệ thống cần đánh cờ "Cần review thủ công".

3. Nhóm Định danh và Phân loại công trình (Classification & Ranking)
Vấn đề: Xung đột thời gian phân hạng (Time-based Ranking Mismatch)
Một bài báo xuất bản năm 2021 khi tạp chí đang ở Q1 (Scopus). Đến năm 2024, tạp chí đó rớt xuống Q3 hoặc bị đưa vào Blacklist. Ứng viên nộp hồ sơ năm 2026. Hội đồng thường tính điểm dựa trên hạng tạp chí tại năm xuất bản.

Giải pháp: Khi gọi API (SCImago/Scopus), phải query lịch sử rank theo Year_of_Publication của bài báo, không dùng rank hiện tại của tạp chí.

Vấn đề: Lẫn lộn giữa Kỷ yếu hội thảo (Proceedings), Preprint và Tạp chí (Journal Article)
Nhiều ứng viên đưa nhầm link bản nháp trên arXiv (Preprint) hoặc Kỷ yếu hội thảo vào chung một danh sách tạp chí.

Giải pháp: Bắt buộc kiểm tra trường document-type từ Crossref/Scopus API (phân loại rõ journal-article, proceedings-article, posted-content).
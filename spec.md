# AI SPEC — VLearn Slide2Study: Từ đúng slide thành bản ôn tập có nguồn · Nhóm BacTrungNam · Zone [X]

Hướng: **[x] A — VLearn**  [ ] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: **[x] Tối ưu tính năng có sẵn**  [ ] Tính năng mới

> Quality bar chốt tại thời điểm commit file này (§7) và giữ nguyên sau đó.
> Script mining tái lập được số liệu §1: `eval/mining/mine_broad_summary.py`.

---

## §1. User & Job

**Job executor.** Học viên khoá AI Thực Chiến đang học trên VLearn trong giờ (`conversation_mode = in_class`, 100% dữ liệu), vừa đọc hết một slide/một bài/một buổi, đang mở panel AI tutor bên cạnh tài liệu và muốn chốt lại ý chính trước khi sang phần sau hoặc trước khi ôn.

*(Worksheet JTBD + job map: `eval/jtbd-worksheet.md` — đính kèm CP1.)*

**Core JTBD** (không tên sản phẩm/AI):
> Chốt lại các ý chính của phần học liệu vừa đọc thành một bản ghi ngắn, đủ tin để dùng lại khi ôn — ngay trong lúc còn đang ở trên tài liệu đó.

**Job stories:**
- Khi vừa nghe hết một buổi và slide còn mở trước mặt, tôi muốn có 3–5 ý chính kèm số trang, để tôi có thể ôn lại mà không phải tua lại toàn bộ slide.
- Khi tôi đang ở trang 37 và không rõ phần này thuộc mạch nào, tôi muốn biết ý chính của cả slide, để tôi định vị được chỗ mình đang đứng.
- Khi tôi hỏi tóm tắt mà trợ lý không lấy được tài liệu, tôi muốn biết ngay nó thiếu gì và tôi làm gì tiếp, để tôi không mất 6 lượt thử vô ích.

**Cách họ đang giải quyết hôm nay & chỗ fail.** Họ gõ thẳng vào chính panel tutor có sẵn ("tóm tắt slide này"). Cách này fail vì tutor được tối ưu cho việc *giải thích đoạn đang bôi đen* — khi không có đoạn chọn, nó không suy ra được phạm vi tài liệu cần lấy, và trả về lời xin lỗi. Họ chưa bỏ nó vì đây là công cụ duy nhất nằm ngay cạnh tài liệu (ChatGPT riêng thì phải tự copy slide sang, mất bước và mất số trang).

**Problem statement** (KHÔNG chữ AI):
> Học viên vừa học xong một slide/bài/buổi, muốn chốt lại ý chính ngay trên trang học, nhưng trợ lý trong trang không xác định được phạm vi học liệu cần lấy khi yêu cầu vượt ra ngoài đoạn đang bôi đen — hậu quả: 64% các lượt hỏi loại này nhận lại lời xin lỗi/từ chối thay vì bản tóm tắt, chỉ 33% có số trang để kiểm lại, và học viên phải hỏi lại nhiều lượt hoặc bỏ cuộc mà không có bản ôn nào.

### Evidence — chuẩn B (mining) · ĐẠT

*Tiêu chí nghiệm thu #2 và R1 chấp nhận chuẩn A **và/hoặc** B — nhóm làm **cả hai**. Chuẩn B (mining) đủ 3 điều kiện: số đếm được · ≥5 ví dụ nguyên văn · phương pháp đếm kiểm lại được, kèm nhóm đối chứng trong cùng bộ dữ liệu. Chuẩn A (khảo sát 25 người) ở cuối §1.*

**Phương pháp đếm** (kiểm lại được — chạy `eval/mining/mine_broad_summary.py`):
1. Nguồn: `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` — 2.522 dòng = 1.261 turn (1 turn = 1 tin học viên + 1 tin tutor), 369 user, 585 hội thoại, 22/07→29/07/2026.
2. Đọc 40 mẫu student message trước khi định nghĩa tiêu chí (theo guide §1.3) → phát hiện format tin nhắn: `(Trang N, đoạn được chọn: "<đoạn>")\n<câu hỏi>`. Khi học viên **gõ vào hộp chat mà không bôi đen**, platform echo lại chính câu vừa gõ vào ô `đoạn được chọn`.
3. **Quy tắc xếp loại — "yêu cầu tóm tắt phạm vi rộng"** = turn thoả cả 3:
   - (a) có từ khoá tóm tắt: `tóm tắt / tóm lại / tóm gọn / tổng hợp / tổng kết / summar / ôn tập / ôn lại / khái quát / overview / nội dung chính / ý chính / điểm chính / trọng tâm`;
   - (b) có từ khoá phạm vi rộng: `toàn bộ / tất cả / cả slide / slide này / bài này / bài học / buổi học / hôm nay / tài liệu / day 0x / bài giảng / ...`;
   - (c) **không có đoạn bôi đen thật** (ô `đoạn được chọn` trùng/lồng với câu hỏi).
4. **Nhóm đối chứng — "yêu cầu giải thích đoạn đang chọn"** = turn có đoạn bôi đen thật (ô `đoạn được chọn` khác câu hỏi).
5. "Mở đầu bằng lời xin lỗi/từ chối" = 220 ký tự đầu của câu trả lời tutor chứa một trong: `xin lỗi / rất tiếc / tiếc là / sorry / không tìm thấy / chưa tìm thấy / không thể / chưa thể / không có quyền truy cập`.
6. "Có nguồn trang" = cột `citations` khác `[]`.

**Số liệu:**

| Chỉ số | Yêu cầu tóm tắt phạm vi rộng | Đối chứng: giải thích đoạn đang chọn |
|---|---|---|
| Số lượt (turn) | **99** | 384 |
| Số hội thoại | 88 | 227 |
| Số user riêng biệt | **77 / 369 (20,9%)** | 169 |
| Trả lời mở đầu bằng xin lỗi/từ chối | **63 / 99 = 64%** | 22 / 384 = **6%** |
| Có nguồn trang (`citations ≠ []`) | **33 / 99 = 33%** | 327 / 384 = **85%** |
| `rating = down` | 5 / 99 | 2 / 384 |
| Hội thoại hỏi lại ≥2 lượt cùng yêu cầu | 7 hội thoại (max **6 lượt** — C0469) | — |

→ Khoảng cách 64% vs 6% và 33% vs 85% cho thấy đây **không phải giới hạn chung của tutor mà là một lỗ hổng cục bộ**: cùng một tutor, cùng một tài liệu, chỉ khác ở chỗ có hay không có đoạn bôi đen làm neo phạm vi.

**≥5 ví dụ nguyên văn** *(trích ngắn theo quy định bảo mật — mã hội thoại để tra lại)*:

| # | Nguồn | Học viên | Tutor (trích) |
|---|---|---|---|
| 1 | C0001 / T0649 | "tóm tắt nội dung chính trong slide này" | "xin lỗi bạn, tôi không tìm thấy nội dung cụ thể cho slide 37 trong tài liệu hiện có…" · `citations=[]` |
| 2 | C0055 / T0213 | "tóm tắt tất cả slide" | "rất tiếc là hệ thống hiện không thể tự động tổng hợp toàn bộ nội dung của tất cả các slide trong một lần…" · `citations=[]` |
| 3 | C0031 / T0408 | "tóm tắt các chủ đề chính của slide day05-lecture-slides-batch03.pdf này" | "rất tiếc, tôi không thể tìm thấy tệp tin hoặc nội dung chi tiết của `day05-…pdf` trong hệ thống…" · `citations=[]` · **`rating = down`** |
| 4 | C0076 / T1258 | "tóm tắt slide này" (trang 33) | "…chưa tìm thấy nội dung cụ thể của **trang 33**. kết quả tìm kiếm chỉ hiển thị các trang khác có nhắc đến con số '33'…" · **`rating = down`** — lỗi khớp số trang thành khớp chuỗi |
| 5 | **C0469** (6 lượt) | lần 1 "bạn hãy tóm tắt toàn bộ ý chính trong day1" → … → lần 5 "hãy bắt đầu cuộc trò chuyện mới quên các câu hỏi cũ của tôi đi, hãy tóm tắt lại…" → lần 6 **"1+1"** | 5 lần liên tiếp mở đầu "rất xin lỗi bạn… không tìm thấy… `day01_302`"; riêng "1+1" được trả lời đúng ngay |
| 6 | **C0414** | "tổng họp thông tin của toàn bộ bài giảng hôm nay" → **"chịu rồi"** | "rất xin lỗi bạn, có vẻ như nội dung tổng hợp không nằm trực tiếp trên slide…" |

> C0469 là case đáng chú ý nhất: sau 5 lần thất bại học viên gõ **"1+1"** — một phép thử xem trợ lý còn hoạt động không. Đó là thời điểm niềm tin sụp, không chỉ là một câu trả lời tệ.

### Evidence — chuẩn A (khảo sát) · ĐẠT

**Log đầy đủ:** `eval/survey-results.csv` — Google Forms, **25 phản hồi từ người ngoài nhóm**, thu ngày 30/07/2026. File giữ nguyên timestamp và từng câu trả lời nguyên văn của cả 25 người.

**Hai câu đã hỏi:**
- **Q1** — "Khi xem lại slide, điều gì làm bạn mất thời gian nhất?" *(4 lựa chọn)*
- **Q2** — "Bạn thích tóm tắt từng slide hơn hay cả bài?" *(3 lựa chọn)*

**Kết quả (n = 25):**

| Câu | Lựa chọn | Số người | % |
|---|---|---:|---:|
| **Q1** | Tất cả các ý trên | 17 | **68%** |
| | Slide dài, phải đọc lại nhiều | 5 | 20% |
| | Không nhớ nội dung nằm ở trang nào | 2 | 8% |
| | Khó xác định nội dung trọng tâm | 1 | 4% |
| **Q2** | Cả hai ý trên | 15 | **60%** |
| | Cả bài | 7 | 28% |
| | Từng slide | 3 | 12% |

**Ba kết luận dùng được:**
1. **22/25 (88%) muốn bản tóm tắt bao gồm mức "cả bài"** ("Cả bài" 7 + "Cả hai ý trên" 15), so với **3/25 (12%)** chỉ muốn từng slide. → Xác nhận trực tiếp lát cắt §4: **phạm vi mặc định phải là bài/buổi, không phải trang đơn lẻ**. Đây cũng là điều nhóm mining thấy độc lập — 99/99 case đều hỏi ở phạm vi rộng hơn một đoạn bôi đen.
2. **60% chọn "cả hai ý trên"** ở Q2 — học viên không muốn bị buộc chọn một mức cố định. → Ủng hộ thiết kế **chip đổi phạm vi ngay trên output** (§4b G9) thay vì chốt cứng một mức.
3. **24/25 (96%)** nêu nguyên nhân mất thời gian có liên quan đến việc **định vị nội dung trong slide** (68% "tất cả các ý trên" + 20% "slide dài phải đọc lại" + 8% "không nhớ nằm ở trang nào"). → Ủng hộ chip `[tr. N]` bấm được để nhảy thẳng tới trang nguồn (§4b G2).

**Ba điều kiện chuẩn A — đối chiếu:**

| Điều kiện | Trạng thái |
|---|---|
| ≥20 người ngoài nhóm | **25** ✅ |
| ≥50% xác nhận | **88%** muốn phạm vi ≥ "cả bài" (22/25) ✅ |
| Log đủ câu hỏi + từng câu trả lời nguyên văn | `eval/survey-results.csv`, 25 dòng + timestamp ✅ |

**Giới hạn của khảo sát này** *(nhóm tự khai)*: cả Q1 và Q2 đều hỏi theo dạng **sở thích**, không phải theo **lần gần nhất** như `02-guide.md` §1.3 khuyến nghị — nên khảo sát cho biết học viên *muốn* gì, không đo được *hiện đang tốn bao nhiêu phút*. Q1 cũng không có phương án phủ định ("không mất thời gian"), nên 96% ở kết luận 3 là phân bố nguyên nhân trong nhóm đã có pain, không phải tỉ lệ mắc pain. **Phần định lượng hậu quả nằm ở chuẩn B** (99 lượt · 77 user · 64% xin lỗi) — hai chuẩn bổ trợ nhau: B chứng minh pain *tồn tại và đo được*, A chứng minh học viên *muốn nó được giải theo hướng nào*.

---

## §2. Impact & quyết định chọn

Mọi con số dưới đây lấy từ cùng một file chatlog (1.261 turn / 369 user / 8 ngày), đếm lại được bằng script trong `eval/mining/`.

| # | Ứng viên | Bao nhiêu người | Tần suất | Mỗi lần tốn gì | Build nổi trong sự kiện? | Chọn? |
|---|---|---|---|---|---|---|
| 1 | **Tóm tắt phạm vi rộng thất bại** — không neo được phạm vi học liệu | **77/369 user (20,9%)**, 88 hội thoại | 99 lượt / 8 ngày ≈ **12 lượt/ngày** | 1 lượt xin lỗi + hỏi lại; case xấu **6 lượt** (C0469) rồi bỏ; **5 `rating=down`** (vs 2/384 ở nhóm đối chứng); mất bản ôn tập | Có — lỗi nằm ở bước chọn phạm vi + prompt, không cần đổi hạ tầng | **✅ CHỌN** |
| 2 | Trả lời không có nguồn trang nói chung | không đo được theo user (rải toàn bộ) | **582/1.261 turn = 46,2%** không có citation | Học viên không kiểm lại được; rủi ro học sai | Không — quá rộng, là bài toán grounding của cả hệ thống, không cắt được thành 1 lát cắt demo 5' | ❌ |
| 3 | Kiểm tra hiểu thật cuối buổi (check-question) | 0 user đang được phục vụ | `asked_check_question = True` **3/1.261 turn (0,2%)**, `follow_ups` và `misconceptions` **0/1.261** | Không đo được — chưa có ai dùng nên chưa có hậu quả quan sát được | Có, nhưng… | ❌ |
| 4 | Latency outlier | 7 turn | **7/1.261 turn > 8s**, max 23,8s (median 1,76s) | Chờ; không mất nội dung | Không — nguyên nhân nằm ở tầng hạ tầng/tool-use, nhóm không truy được | ❌ |
| 5 | Sinh quiz ôn tập từ slide | **3 user**, 3 hội thoại | **4 lượt / 8 ngày** | Không có quiz | Có | ❌ |

**Ứng viên đã loại + lý do (bằng số):**
- **#2 (46,2% không citation)** — số lớn nhất trong bộ dữ liệu, nhưng không quy được về *một* người dùng làm *một* việc: nó là thuộc tính của mọi câu trả lời. Vi phạm tiêu chí "lát cắt MỘT CÂU". Ứng viên #1 là **tập con có bằng chứng mạnh nhất** của #2 (33% citation vs 85% ở nhóm đối chứng) — giải #1 là giải một lát của #2 với pain đo được.
- **#3 (check-question)** — 3/1.261 lượt và 2 field (`follow_ups`, `misconceptions`) chưa từng có dữ liệu: đây là **tính năng chưa dùng**, không phải pain đã quan sát được. Không đếm được pain từ chatlog, nên không có evidence chuẩn B — chọn nó là bắt đầu từ 0 bằng chứng trong nửa ngày.
- **#4 (latency)** — 7/1.261 = 0,6% và nguyên nhân nằm ở `llm_call_count` 2–7 lần / tool-use trung gian mà nhóm không có quyền truy cập. Không sửa được, chỉ mô tả được.
- **#5 (quiz)** — 4 lượt / 3 user so với 99 lượt / 77 user của #1: **kém 24 lần về tần suất** và 25 lần về số người. Build nổi nhưng pain nhỏ hơn hẳn.

**Ứng viên CHỌN + vì sao (bằng số):** #1 thắng trên cả ba trục — số người (77 vs 3 vs 0), tần suất (12 lượt/ngày vs 0,5 vs 0,4), và **có nhóm đối chứng trong cùng bộ dữ liệu** (64%/33% vs 6%/85%) chứng minh đây là lỗ hổng cục bộ sửa được, không phải giới hạn của mô hình. Thêm nữa, hậu quả có bằng chứng hành vi: 7 hội thoại hỏi lại ≥2 lượt, C0469 bỏ cuộc sau 6 lượt, C0414 gõ "chịu rồi".

---

## §3. Giải pháp tương tự đã nghiên cứu

*(Mỗi thành viên dùng thử 15' theo guide §2.2 — mỗi người chịu trách nhiệm giải thích được ô của mình tại CP5.)*

| Sản phẩm | Flow họ giải job này | Đáng học (quan sát cụ thể) | Đáng né | Slide2Study khác gì |
|---|---|---|---|---|
| **NotebookLM** *(Hiếu)* | Upload nguồn → chọn nguồn nào đưa vào ngữ cảnh → "Summarize" sinh bản ghi có chú thích trỏ về nguồn | Câu trả lời nào cũng có **chip số trích dẫn ngay cạnh câu**, bấm vào nhảy tới đúng đoạn nguồn; bản thân UI ép grounding | Bắt user tự chọn nguồn trước — thêm một bước; và im lặng bỏ qua nguồn không đọc được | Ta **suy phạm vi từ ngữ cảnh trang đang mở** (`day_code` + số trang) thay vì bắt chọn; nhưng hiện phạm vi đã suy ra để user sửa được |
| **ChatGPT Study Mode** *(Thành)* | Hỏi lại để biết trình độ/mục tiêu → dẫn từng bước, không đưa đáp án ngay | **Hỏi lại đúng một câu rồi mới làm** khi mục tiêu chưa rõ — không đoán bừa | Hỏi lại quá nhiều lượt khi user chỉ muốn kết quả nhanh | Chỉ hỏi lại **tối đa 1 lần**, và chỉ khi phạm vi mơ hồ (§6); mọi lần hỏi lại đều kèm nút chọn nhanh slide/bài/buổi |
| **Khanmigo** *(Quỳnh)* | Trợ lý gắn trong bài học, biết học viên đang ở đơn vị nội dung nào | Trợ lý **biết ngữ cảnh vị trí** của học viên nên không phải hỏi "bạn đang học bài nào" | Giọng dẫn dắt dài, học viên VN gõ "tóm tắt slide này" sẽ thấy vòng vo | Output **3–5 bullet, ≤120 từ**, không lời dẫn; giọng ngắn theo cách học viên thật gõ (§4b G5) |
| **Quizlet AI / Gemini "Summarize this page"** *(Huy)* | Tóm tắt thẳng nội dung đang mở, không hỏi gì | Không có ma sát: một cú bấm ra kết quả | **Thất bại im lặng** — không lấy được nội dung thì vẫn viết ra một bản tóm tắt chung chung, không nói là nó không đọc được gì. Đây đúng là lỗi ta đang sửa | Không lấy được học liệu thì **nói rõ thiếu gì + đưa hành động tiếp**, tuyệt đối không tóm tắt từ kiến thức nền (§5 lớp ①) |

---

## §4. Thiết kế

**Lát cắt MỘT CÂU:**
> **Một học viên vừa học xong một slide/bài trên VLearn · muốn có bản ôn tập ngắn của phần vừa học · AI quyết định đúng phạm vi học liệu cần lấy và chỉ giữ lại các ý truy được về số trang · học viên nhận 3–5 ý chính có số trang, dùng được ngay, trong một lượt.**

**Non-goals — KHÔNG build:**
1. **Không** sinh quiz / flashcard / câu hỏi ôn tập từ bản tóm tắt (ứng viên #5 đã loại).
2. **Không** tóm tắt nhiều buổi hoặc cả khoá trong một lượt — phạm vi tối đa là **một buổi** (`day_code`).
3. **Không** sửa tầng retrieval/index của VLearn, không sửa latency, không sửa cách chấm citation của hệ thống gốc.
4. **Không** lưu / đồng bộ / xuất bản ghi ôn tập ra ngoài phiên làm việc (không có account, không có DB).
5. **Không** trả lời câu hỏi ngoài học liệu buổi đang mở (logistics, deadline, điểm) — chuyển hướng, xem §5 lớp ③.

**Mức prototype nhắm tới: [ ] Sketch · [x] Mock · [ ] Working**

| Thành phần | Thật / Mock | Ghi chú |
|---|---|---|
| Panel tutor + viewer PDF, bôi đen chọn đoạn, chọn trang | **Thật** — `codebase/frontend/src/components/SlideViewer.tsx`, text layer từ `pdfjs-dist` | Tài liệu demo: `Day02.pdf` |
| **Quyết định phạm vi + sinh tóm tắt có nguồn** *(quyết định trung tâm)* | **AI THẬT** — Gemini qua `codebase/frontend/server.ts` → `POST /api/tutor/chat` | Log/trace mọi lượt gọi trong `eval/traces/` |
| Kho học liệu / retrieval theo `day_code` | **MOCK** — text trích từ chính PDF đang mở (client-side extract, `onExtractPageText`) đóng vai "học liệu buổi đã index" | Có chủ ý: lỗi gốc nằm ở *quyết định phạm vi*, không ở chất lượng index. Mock này cho phép tạo được cả case "lấy được" và case "không lấy được" |
| Fallback khi thiếu `GEMINI_API_KEY` | **MOCK** — `generateFallbackResponse()` | Chỉ để UI không vỡ khi mất mạng; **không** dùng cho bất kỳ số liệu nào trong §7 |

**Automation: [ ] augment · [x] conditional · [ ] automate**

Lý do theo cost-of-error: AI **tự làm** khi lấy đủ học liệu và mọi ý đều truy được về số trang; **hỏi lại đúng 1 lần** khi phạm vi mơ hồ (slide / bài / buổi?); **từ chối có hướng dẫn** khi không lấy được học liệu. Chọn conditional vì cost-of-error bất đối xứng: một bản tóm tắt bịa đọc *mượt hơn* một lời xin lỗi, nên học viên sẽ tin và **mang kiến thức sai vào bài kiểm tra** — sai này người dùng không tự phát hiện được, sửa rất đắt (phải học lại). Ngược lại, chi phí của việc hỏi lại 1 câu chỉ là ~5 giây. Không chọn `automate` vì đúng lý do đó; không chọn `augment` vì với case chắc (có học liệu, có trang) việc bắt học viên duyệt từng bullet là ma sát vô nghĩa — 384 turn nhóm đối chứng cho thấy khi có neo phạm vi thì tutor cite đúng 85%.

### §4b. Nguyên tắc đã áp dụng

| Nguyên tắc | Áp cụ thể vào đâu trong prototype |
|---|---|
| **G1 — Làm rõ hệ thống làm được gì** | Dòng đầu panel thay câu chào chung bằng phạm vi + hành động: "Mình tóm tắt được **trang đang mở**, **bài này**, hoặc **cả buổi Day02** — chọn một mức bên dưới." Vị trí: `AITutorPanel.tsx`, khối `selectedContext` khởi tạo trong `App.tsx:21-25` |
| **G2 — Làm rõ nó làm tốt đến đâu** | Mỗi bullet trong bản tóm tắt bắt buộc gắn **chip `[tr. N]`** bấm được → nhảy tới trang đó trong viewer (`onPageChange`). Không có trang → bullet không được xuất hiện. Header bản tóm tắt ghi "Dựa trên 12/48 trang lấy được của Day02" |
| **G10 — Thu hẹp phạm vi khi nghi ngờ** *(bắt buộc)* | Khi yêu cầu không nêu phạm vi (99/99 case mining đều thuộc dạng này), server trả `need_scope` + 3 nút `Trang N / Bài này / Cả buổi` thay vì đoán. Tối đa **1** lần hỏi lại/lượt; lần 2 tự chọn mức hẹp nhất và ghi rõ "Mình tóm tắt trang N — đổi phạm vi ở trên nếu chưa đúng" |
| **G11 — Giải thích vì sao** | Khi không lấy được học liệu, thay "xin lỗi, tôi không tìm thấy" bằng lý do + hành động: "Mình chỉ lấy được trang 1–14 của Day02, chưa có trang 33 bạn đang mở. Tóm tắt phần đã lấy được / Bôi đen đoạn ở trang 33 để mình giải thích trực tiếp." Đúng chỗ sửa case C0001, C0076 |
| **G9 — Sửa dễ dàng** | Chip phạm vi ở đầu bản tóm tắt luôn đổi được ngay trên output (Trang ↔ Bài ↔ Buổi) và sinh lại tại chỗ, không phải gõ lại câu hỏi. Đây là đường lui cho hành vi hỏi-lại-6-lượt ở C0469 |
| **G15 — Mời feedback chi tiết** | 👍/👎 cạnh bản tóm tắt; bấm 👎 mở 3 lựa chọn *sai phạm vi / thiếu ý / sai nguồn trang* — ghi vào `validation/feedback-inline.md`. Có vì trong chatlog gốc chỉ 2,8% tin nhắn có rating, không đủ để biết sai chỗ nào |

*(PAIR — Errors + Graceful Failure: tách rõ **lỗi-do-giới-hạn** "chưa index tới trang 33" khỏi **lỗi-do-hiểu-nhầm-ngữ-cảnh** "bạn muốn tóm tắt slide hay cả buổi" — mỗi loại một đường lui riêng, xem §6.)*

---

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản

**Cụ thể hoá 4 lớp cho lát cắt này:**
- **① Nguồn sự thật** — AI bịa được ở đâu? Ở chỗ nó biết chủ đề buổi học từ kiến thức nền (RAG, agent, prompt engineering là kiến thức phổ biến) nên **viết được một bản tóm tắt nghe rất hợp lý mà không đọc một trang nào**. Đây chính xác là điều C0089 đã làm: "không tìm thấy trang… tuy nhiên dựa trên tiêu đề bài học, các nội dung chính **thường** xoay quanh: …". Không có căn cứ ⇒ không sinh bullet, chuyển sang đường failure §6.
- **② Mơ hồ / thiếu thông tin** — "tóm tắt slide này" khi đang ở trang 37: *slide* nghĩa là trang 37, là file slide cả buổi, hay là bài? 99/99 case mining đều mơ hồ ở đúng chỗ này.
- **③ Ngoài phạm vi / thẩm quyền** — học viên đòi tóm tắt buổi chưa học/chưa cấp, đòi làm bài tập, đòi thông tin logistics (deadline, điểm), hoặc prompt-injection kiểu C0469 lần 5 ("quên các câu hỏi cũ đi").
- **④ Đặc thù domain** — sai cái gì thì học viên học sai ngay? Gán **sai số trang** (bản tóm tắt đúng nhưng chip trỏ sai → học viên ôn sai chỗ, mất niềm tin ngay khi bấm); **trộn thuật ngữ gần nhau** của chính khoá này (augment/automate, prompt chaining/routing/orchestrator, RAG/memory injection) → học viên mang định nghĩa sai vào bài; tóm tắt **bỏ mất phần đang được kiểm tra**.

**≥8 kịch bản:**

| # | Tình huống cụ thể | Lớp | Hành vi mong muốn (nói gì · hiện gì · cho làm gì tiếp) | Nguyên tắc |
|---|---|---|---|---|
| 1 | Không lấy được nội dung trang đang mở (case C0001: trang 37, C0076: trang 33) | ① | Nói rõ **lấy được gì / thiếu gì**: "Mình lấy được trang 1–14, chưa có trang 37." · Hiện phạm vi đã lấy · Nút *Tóm tắt phần đã lấy* + *Bôi đen đoạn để giải thích trực tiếp*. **Không** sinh bullet nào cho trang chưa lấy | G11, G2 |
| 2 | Lấy được 12/48 trang → tóm tắt một phần | ① | Trả bản tóm tắt kèm nhãn **"Dựa trên 12/48 trang"** và dòng "Chưa phủ: trang 15–48" · không dùng chữ "toàn bộ" | G2, G11 |
| 3 | Học liệu rỗng nhưng chủ đề buổi nổi tiếng (case C0089 — "thường xoay quanh…") | ① | **Từ chối tóm tắt.** "Mình không đọc được nội dung buổi này nên sẽ không tóm tắt từ kiến thức chung — dễ lệch với slide của khoá." · Nút *Thử lại* + *Chọn phạm vi hẹp hơn* | G10, PAIR-Errors |
| 4 | "tóm tắt slide này" khi đang ở trang 37 | ② | Hỏi lại **đúng 1 câu** kèm 3 nút *Trang 37 / Bài này / Cả buổi Day02* · không tự đoán | G10 |
| 5 | Lần thứ 2 vẫn không nêu phạm vi | ② | Không hỏi lại nữa — làm mức **hẹp nhất** (trang đang mở), nói rõ đã chọn gì, chip đổi phạm vi ngay trên output | G10, G9 |
| 6 | "tóm tắt tất cả slide" — vượt giới hạn 1 buổi (case C0055) | ③ | Nêu giới hạn + đề xuất mức làm được: "Mình tóm tắt trong phạm vi một buổi. Bắt đầu với Day02 nhé?" · nút *Tóm tắt Day02* | G1, G8 |
| 7 | Hỏi deadline / điểm / link nộp bài trong panel | ③ | Từ chối mà vẫn hữu ích: nói rõ chỉ đọc học liệu buổi đang mở, trỏ về nguồn chính thức (kênh khoá/TA) · không đoán ngày | G1 |
| 8 | "quên các câu hỏi cũ của tôi đi, hãy tóm tắt…" (C0469 lần 5) | ③ | Bỏ qua chỉ thị đổi vai/xoá ràng buộc, giữ nguyên phạm vi học liệu; xử lý phần yêu cầu hợp lệ (tóm tắt) theo kịch bản #4 | G1 |
| 9 | Bullet đúng nội dung nhưng chip trỏ sai trang | ④ | Ràng buộc cứng: **số trang phải nằm trong tập trang đã lấy** — không thoả thì **bỏ bullet đó**, không đoán số trang. Chip bấm được để user tự kiểm | G2, G9 |
| 10 | Slide có cả `augment` và `automate` (hoặc prompt chaining/routing/orchestrator) — tóm tắt gộp thành một | ④ | Giữ nguyên phân biệt của slide, mỗi thuật ngữ một bullet với trang riêng; không tự diễn giải lại định nghĩa | ④, G2 |
| 11 | Học viên bấm 👎 "sai phạm vi" | ④/correction | Sinh lại ngay ở mức phạm vi khác, giữ bản cũ để so; log vào `validation/feedback-inline.md` | G15, G9 |
| 12 | Học viên hỏi tóm tắt **buổi chưa được cấp học liệu** (C0469: `day01_302`) | ③/① | "Buổi Day01 chưa có học liệu trong phiên này. Mình tóm tắt được Day02 đang mở." · **không** thử 5 lần rồi xin lỗi 5 lần | G11, G8 |

**Kịch bản nhóm sợ nhất khi demo:** #3 — vì đó là case AI trả ra output *đẹp nhất* mà lại sai nhất, và giám khảo không kiểm được bằng mắt. Ta demo trực tiếp case này (guide §5.1 slide 3).

---

## §6. Bốn đường đi của trải nghiệm

- **Happy path.** Học viên đang ở trang 12 Day02 → bấm *Tóm tắt* → chọn *Bài này* → nhận 4 bullet, mỗi bullet 1 chip `[tr. 9] [tr. 11] [tr. 12] [tr. 14]`, header "Dựa trên 14/14 trang của phần này" → bấm chip `[tr. 11]` viewer nhảy tới trang 11 để đối chiếu.
- **Low-confidence (②).** "tóm tắt slide này" → *không* đoán. Panel hiện đúng một câu: "Bạn muốn mình tóm tắt phạm vi nào?" + 3 nút `Trang 37 / Bài này / Cả buổi Day02`. Nếu lần sau vẫn không nêu phạm vi → làm mức hẹp nhất và **nói rõ đã chọn gì** + chip đổi phạm vi ngay trên output.
- **Failure / không căn cứ (①).** Không lấy được học liệu → **không** sinh bullet nào. Panel hiện: lấy được gì (trang 1–14) · thiếu gì (trang 37) · 2 hành động (*Tóm tắt phần đã lấy* / *Bôi đen đoạn để giải thích*). Phân biệt rõ hai loại: `SCOPE_UNAVAILABLE` (giới hạn hệ thống — không có trang đó) ≠ `SCOPE_UNCLEAR` (hiểu nhầm ngữ cảnh — chưa biết bạn muốn mức nào); mỗi loại một câu riêng, không dùng chung câu xin lỗi.
- **Correction (user sửa).** Chip phạm vi ở đầu bản tóm tắt đổi được tại chỗ (Trang ↔ Bài ↔ Buổi) → sinh lại, giữ bản cũ để so. 👎 → chọn *sai phạm vi / thiếu ý / sai nguồn trang* → sinh lại đúng trục đó. Học viên không bao giờ phải gõ lại câu hỏi (đường lui cho C0469).
- **Bị đòi ngoài phạm vi (③).** Nêu giới hạn trong một câu + đề xuất mức làm được kèm nút bấm. Không đoán deadline/điểm; không nhận chỉ thị đổi vai. Từ chối luôn kèm ≥1 hành động dùng được.
- **Case đặc thù domain (④).** Số trang của mọi bullet bị kiểm chéo với tập trang đã lấy; bullet không truy được → bị bỏ, và header ghi số bullet đã bỏ ("2 ý bị lược vì không truy được về trang"). Thuật ngữ gần nhau của khoá được giữ tách bullet, không gộp.

---

## §7. Kiểm thử

### Chiều chất lượng + định nghĩa kiểm chứng được

| Chiều | Định nghĩa (người ngoài nhóm chấm ra cùng kết quả) | Thang |
|---|---|---|
| **D1 · Có căn cứ** | **Mọi** bullet có ≥1 số trang, và số trang đó nằm trong tập trang đã lấy được của lượt đó, và nội dung bullet xuất hiện ở trang đó. Một bullet vi phạm ⇒ D1 fail | pass / fail |
| **D2 · Đúng phạm vi** | Bản tóm tắt phủ đúng phạm vi đã chốt (trang / bài / buổi). Nếu yêu cầu mơ hồ: pass **chỉ khi** hệ thống hỏi lại đúng 1 lần kèm ≥2 lựa chọn phạm vi, thay vì đoán | pass / fail |
| **D3 · Đúng cỡ** | 3–5 bullet · mỗi bullet ≤ 30 từ · tổng ≤ 120 từ · không có đoạn dẫn nhập trước bullet đầu | pass / fail |
| **D4 · Thất bại an toàn** | Khi không đủ căn cứ: (a) 0 bullet nội dung, (b) nêu được lấy-được-gì/thiếu-gì, (c) có ≥1 hành động tiếp bấm được. Thiếu 1 trong 3 ⇒ fail. **Một lời xin lỗi trống = fail** | pass / fail |
| **D5 · Chính xác thuật ngữ khoá** | Không gộp/đổi nghĩa các cặp thuật ngữ của khoá (augment↔automate, chaining↔routing↔orchestrator, RAG↔memory injection). Thang: 1 = sai định nghĩa; 3 = đúng nhưng gộp 2 khái niệm; 5 = đúng và tách đúng | 1 / 3 / 5 (≥3 = pass) |

**Case pass** = D1 ∧ D2 ∧ D3 ∧ D4 ∧ (D5 ≥ 3).

*Test độ rõ (guide §2.6 bước 4):* Thành và Huy chấm độc lập cùng 5 output → so lệch → sửa lại định nghĩa nếu lệch. Kết quả ghi ở `eval/rater-agreement.md`. **Hạn: trước lượt đo 1.**

### Golden set — ≥20 case · file: `eval/golden-set.md`

Cơ cấu (theo guide §2.6 mục 5):

| Nhóm | Số case | Case ID | Nguồn |
|---|---|---|---|
| Lớp ① Nguồn sự thật | 3 | G01–G03 | C0001, C0076, C0089 (chatlog thật) |
| Lớp ② Mơ hồ | 3 | G04–G06 | C0003 ("tóm tắt"), C0064, C0058 (chatlog thật) |
| Lớp ③ Ngoài phạm vi | 3 | G07–G09 | C0055, C0469-lần5, tự tạo (logistics) |
| Lớp ④ Đặc thù domain | 3 | G10–G12 | Day02.pdf (augment/automate, chaining/routing), C0010 (memory injection) |
| Case thường | 9 | G13–G21 | 6 từ chatlog thật (C0048, C0065, C0070, C0075, C0090, C0104) + 3 tự tạo |
| Case hiếm | 3 | G22–G24 | C0469 (6 lượt liên tiếp), C0414 ("chịu rồi"), tài liệu 1 trang |
| **Tổng** | **24** | | **trong đó ≥14 case lấy từ chatlog thật** ✅ (yêu cầu ≥10) |

### Quality bar — CHỐT tại thời điểm commit file này, giữ nguyên sau đó

> **Đạt khi ≥ 70% case qua trọn bộ golden set (24 case), VÀ hai điều kiện cứng:**
> 1. **0 case bịa nguồn** — không case nào fail D1 vì bullet có số trang không nằm trong tập trang đã lấy. Một case vi phạm ⇒ toàn bộ lượt đo **không đạt bar**, bất kể %.
> 2. **100% case lớp ① và ③ pass D4** — không lượt nào trả về lời xin lỗi trống không kèm hành động tiếp.

*Lý do đặt 70% mà không cao hơn:* baseline hiện tại của tutor trên chính nhóm case này là **33% có nguồn trang / 36% không mở đầu bằng xin lỗi**; nhóm đối chứng (có neo phạm vi) đạt **85% có nguồn trang** — đó là mức trần thực tế mà cùng tutor này làm được. Bar 70% nằm giữa baseline và trần: gấp đôi baseline, đo được trong thời gian sự kiện. Hai điều kiện cứng đặt ở D1 và D4 vì đó là hai lỗi mà học viên **không tự phát hiện được** (§4 cost-of-error).

### Kết quả các lượt chạy — `eval/EVAL_LOG.md` · `eval/results/` · trace `eval/traces/`

**Bộ A — 24 ca tóm tắt có nguồn** *(harness UI, file `eval/results/{variant}-cases.csv` + `{variant}-summary.json`)*

| Lượt | Thời điểm | Pass / 24 | % | D1 fail | D4 fail (①③) | Đối chiếu bar | Sửa gì sau lượt này |
|---|---|---|---|---|---|---|---|
| 1 · `happy-path-full` | 31/07/2026, trước commit `c2dc0d4` | **18 / 24** | 75% | **0** | 0 — nhưng **5 ca (G20–G24) rơi vào fallback mock** ("dịch vụ AI tạm không khả dụng") | **Không tính là lượt đo hợp lệ** — §4 cấm dùng số của `generateFallbackResponse()` cho §7 | Đổi provider / API key (`c2dc0d4`) để hết rơi fallback |
| 2 · `ten-luot-chay` | 31/07/2026, commit `c2dc0d4` | **20 / 24** | 83% | **0** | 1 ca (G16) vẫn rơi fallback | ≥70% ✅ · 0 bịa nguồn ✅ (`evidence_source_match_rate = 1.0`) · trừ G16 thì 20/23 = 87% | Sửa G14/G24 (thiếu ý khoá khi phạm vi rộng); G13 chỉ còn 2 ý sau khi ẩn ý không khớp nguồn ⇒ fail D3 dù D1 đúng |
| 3 | *(chưa chạy)* | — | — | — | — | — | Cần chạy lại sau `319818f` và trên đúng bộ `eval/golden-set.md` |

*Ca fail lượt 2:* **G13** (2/3 ý — 1 ý bị ẩn vì nguồn không khớp, đúng luật §5 #9 nhưng fail D3 "3–5 bullet") · **G14**, **G24** (term recall 0,4 — thiếu ý khoá ở phạm vi rộng) · **G16** (fallback mock, không phải lỗi mô hình).
*Chỉ số phụ lượt 2:* citation hợp lệ 95,8% · evidence khớp nguồn **100%** · term recall trung bình 0,838 · độ trễ p50 **2.416 ms** / p95 **4.284 ms**.

**Bộ B — product eval 25 hành vi** *(`eval/run_product_eval.py`, log đầy đủ ở `eval/EVAL_LOG.md`)*

| Lượt | Thời điểm | Commit | Pass / 25 | % | Ca chưa đạt | Đối chiếu bar |
|---|---|---|---|---|---|---|
| 1 | 31/07/2026 10:11 | `4970ff5` | **23 / 25** | 92% | P06, P14 | ≥70% ✅ · 0 bịa nguồn ✅ — rà tay 13/13 phản hồi AI, không ý nào trái nguồn đã chọn (`results/product-current-manual-review.md`) |
| 2 | 31/07/2026 11:49 | `66157fd` | **22 / 25** | 88% | P06, P13, P14 | ≥70% ✅ · P13 dao động giữa hai lượt, không phải lỗi nguồn |
| 3 | 31/07/2026 14:29 | `319818f` | **23 / 25** | 92% | P06, P14 | ≥70% ✅ · kiểm tra phạm vi/nguồn **100%** · 100% ca dùng phản hồi AI thật · p50 2.253 ms / p95 3.592 ms |

*Hai lỗi còn lại (lượt 3):* **P06** — không nhận "tổng hợp toàn bộ" là yêu cầu tóm tắt (lỗi hiểu ý định, nguồn C0065/T1019) · **P14** — tóm tắt cả 44 trang chỉ giữ 1/5 ý khoá (**thiếu bao phủ, không phải bịa nguồn** — mọi ý đều đúng nguồn, xác nhận ở rà soát thủ công).
*Theo nhóm hành vi (lượt 3):* Hiểu yêu cầu tóm tắt 6/7 · Chất lượng tóm tắt 6/7 · Hỏi tiếp & chế độ học 4/4 · AI Note 7/7.

**Ghi chú đọc bảng — chênh so với định nghĩa ở trên (nhóm tự khai):**
1. **Bộ 24 ca trong `eval/golden-set.md` chưa được chạy.** Bộ A dùng lại mã `G01–G24` nhưng nội dung là ca tóm tắt theo trang của `Day02.pdf`, không phải 4 kiểu tình huống (①–④) đã định nghĩa; bộ B là 25 ca hành vi sản phẩm. ⇒ **Việc cần làm trước CP5:** chạy đúng `golden-set.md` để đối chiếu trực tiếp với bar §7.
2. **D1/D4 trong bảng bộ A là ánh xạ từ chỉ số harness**, không phải điểm chấm tay: D1 ≈ `citation_valid` ∧ `source_match_rate = 1.0`; D4 ≈ ca không đủ căn cứ thì sinh 0 bullet. D2/D3/D5 chưa có cột riêng — G13 fail D3 là do đọc tay từ `point_count`.
3. Kết quả AI dao động giữa các lượt (P13 đạt → chưa đạt → đạt), nên mọi lượt đều ghi kèm thời gian + commit + trạng thái working tree. **Bar giữ nguyên sau khi thấy kết quả** (guide §4.1); mọi ca fail đều được ghi, không lược.

---

## §8. Phân công & kế hoạch

**Phân công có tên:**

| Người | Phần chịu trách nhiệm | Artifact |
|---|---|---|
| **Hiếu** | Evidence — mining chuẩn B (quy tắc xếp loại, script đếm, nhóm đối chứng, 6 ví dụ nguyên văn) + khảo sát chuẩn A (25 phản hồi, thiết kế form, tổng hợp kết quả) | `eval/mining/mine_broad_summary.py`, `eval/survey-results.csv`, spec §1–§2 |
| **Thành** | AI / prompt — thiết kế quyết định phạm vi, prompt sinh tóm tắt có nguồn, golden set + chạy đo | `codebase/frontend/server.ts`, `eval/golden-set.md`, `eval/run-*.md` |
| **Quỳnh** | Build / giao diện — panel tóm tắt, chip `[tr. N]`, nút chọn phạm vi, 4 đường đi §6 | `codebase/frontend/src/components/` |
| **Huy** | Spec + validation — file này, tổ chức vòng user test, changelog, slide demo | `spec.md`, `validation/`, `demo-slides.pdf` |

*Vibe-coding rule: mỗi người phải giải thích được phần có tên mình tại CP5.*

**Willing users (≥3 người NGOÀI nhóm) 

| Tên | Vai | Đã đồng ý thử? |
|---|---|---|
| *Nguyễn Thành Long* | học viên khoá | ☑ |
| *Hoàng Hương Giang* | học viên khoá | ☑ |
| *Nguyễn Ngọc Lan* | học viên khoá | ☑ |
| *Nguyễn Hoàng Duy* | học viên khoá | ☑ |

**Kế hoạch vòng validation (CP5)** — 10'/người, 5 người, theo guide §4.2:
1. Giao task thật: *"Bạn vừa học hết Day02. Dùng cái này để chuẩn bị ôn tập."* → **im lặng quan sát**, ghi họ bấm gì, kẹt đâu.
2. Hỏi đúng 3 câu: *"Điều gì khó hiểu hoặc khó chịu nhất?"* · *"Kết quả này bạn có tin không — vì sao?"* · *"Bạn có dùng thật không — vì sao / vì sao chưa?"*
3. Log nguyên văn: `validation/feedback-log.md` — **Huy log, Quỳnh vận hành máy.** Nếu toàn lời khen ⇒ phiên chưa đạt, đổi người/tăng độ khó task.

**Multi-prototype** — trục khác biệt: **hỏi phạm vi trước vs tóm tắt mức hẹp nhất luôn rồi cho đổi**.
- Phương án A: hỏi lại trước khi làm (an toàn hơn, thêm 1 lượt).
- Phương án B: làm ngay mức hẹp nhất + chip đổi phạm vi trên output (nhanh hơn, rủi ro sai phạm vi).
- **Chưa chốt** — thử cả hai giữa CP2 và CP3, chọn theo D2 trên golden set + phản hồi validation. Giữ lại bằng chứng phương án bị loại. *(Thành + Quỳnh.)*

---

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| CP1 → spec v1 | Canvas 7 dòng → spec đầy đủ §1–§8 | Chuẩn hoá theo `03-template-ai-spec.md` |
| spec v1 | Số liệu mining đếm lại bằng script, chốt: 99 lượt / 88 hội thoại / 77 user; **63/99** xin lỗi; 33/99 có trang | Canvas ghi 98/88/75 và 59/98 — chênh do chưa có quy tắc xếp loại viết ra. Nay quy tắc ghi ở §1 và tái lập được bằng `eval/mining/mine_broad_summary.py` (chạy ra đúng các số này) |
| spec v1 | Bổ sung nhóm đối chứng "giải thích đoạn đang chọn" (384 turn · 6% xin lỗi · 85% có trang) | Cần chứng minh đây là lỗ hổng cục bộ sửa được, không phải giới hạn chung của tutor — nếu không, ứng viên #2 mới là bài toán đúng |
| spec v1 | Willing users chuyển thành "chưa chốt" | 3 tên trong canvas CP1 đều là thành viên nhóm; tiêu chí #5 và R6 yêu cầu người ngoài nhóm |
| spec v1 | Bổ sung khảo sát chuẩn A vào §1 (n=25) — evidence nay đạt **cả hai chuẩn A và B** | Có đủ 25 phản hồi ngoài nhóm + log nguyên văn ⇒ đủ 3 điều kiện chuẩn A. Kết quả chính (88% muốn phạm vi ≥ "cả bài") xác nhận độc lập lát cắt §4 vốn chỉ dựa trên mining |
| 31/07/2026 | Điền §7 "Kết quả các lượt chạy" bằng số đo thật: bộ A 24 ca (18/24 → 20/24), bộ B product eval 25 hành vi (23 → 22 → 23 / 25) | Số lấy nguyên từ `eval/EVAL_LOG.md` + `eval/results/*-summary.json` + `*-cases.csv`, mỗi lượt kèm commit. Lượt A-1 bị đánh dấu **không hợp lệ** vì 5/24 ca rơi vào fallback mock — §4 đã cấm dùng số fallback cho §7 |
| 31/07/2026 | Ghi rõ bộ 24 ca trong `eval/golden-set.md` **chưa chạy**; hai bộ đang có là bộ khác | Bộ A trùng mã `G01–G24` nhưng nội dung là ca tóm tắt theo trang, không phải 4 kiểu ①–④. Không gộp hai bộ để tránh báo cáo pass rate không đúng bar §7 |
| 31/07/2026 | Willing users: 4 người ngoài nhóm đã tick đồng ý thử | Đủ yêu cầu ≥3 người ngoài nhóm (tiêu chí #5, R6) |

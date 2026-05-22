import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const AdminContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // 상태 변경 모달
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  // 답변 작성 모달
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  
  const [selectedContact, setSelectedContact] = useState(null);
  const [replyText, setReplyText] = useState(""); // 답변 텍스트 상태

  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("name");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("http://localhost:3000/api/admin/contacts", {
          withCredentials: true,
        });
        setContacts(response.data);
      } catch (error) {
        console.log("문의글 가져오기 실패: ", error);
      }
    };
    fetchContacts();
  }, []);

  // --- 상태 수정 핸들러 ---
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedContact) return;
    try {
      await axios.put(`http://localhost:3000/api/admin/contacts/${selectedContact._id}`,
        { status: newStatus },
        { withCredentials: true }
      );

      setContacts(contacts.map(contact =>
        contact._id === selectedContact._id ? { ...contact, status: newStatus } : contact
      ));

      setIsStatusModalOpen(false);
      Swal.fire("수정완료!", "상태가 성공적으로 수정되었습니다.", "success");
    } catch (error) {
      Swal.fire("오류 발생", "수정 중 문제가 발생했습니다.", "error");
    }
  };

  // --- 답변 등록 핸들러 ---
  const handleReplySubmit = async () => {
    if (!selectedContact || !replyText.trim()) return;
    try {
        await axios.put(`http://localhost:3000/api/admin/contacts/${selectedContact._id}/reply`,
            { reply: replyText },
            { withCredentials: true }
        );

        // 로컬 상태 업데이트 (상태를 '완료'로, reply 내용 추가)
        setContacts(contacts.map(contact =>
            contact._id === selectedContact._id ? { ...contact, status: "완료", reply: replyText } : contact
        ));

        setIsReplyModalOpen(false);
        setReplyText("");
        Swal.fire("답변 등록", "답변이 등록되고 상태가 '완료'로 변경되었습니다.", "success");
    } catch (error) {
        console.error(error);
        Swal.fire("오류", "답변 등록 중 문제가 발생했습니다.", "error");
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '삭제하시겠습니까?',
      text: "이 작업은 되돌릴 수 없습니다!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '삭제',
      cancelButtonText: '취소'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`http://localhost:3000/api/admin/contacts/${id}`, {
          withCredentials: true,
        });
        setContacts(contacts.filter(contact => contact._id !== id));
        Swal.fire("삭제완료!", "문의가 성공적으로 삭제되었습니다.", "success");
      } catch (error) {
        Swal.fire("오류 발생", "삭제 중 문제가 발생했습니다.", "error");
      }
    }
  };

  const openStatusModal = (contact) => {
    setSelectedContact(contact);
    setIsStatusModalOpen(true);
  };

  const openReplyModal = (contact) => {
    setSelectedContact(contact);
    setReplyText(contact.reply || ""); // 기존 답변이 있으면 불러옴
    setIsReplyModalOpen(true);
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const value = (contact[searchType] || '').toString().toLowerCase();
      const matchesSearch = value.includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || contact.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contacts, searchTerm, searchType, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="p-4 mx-auto max-w-[1400px]">
      <h1 className="text-4xl font-bold mt-6 mb-4">문의 관리</h1>

      {/* 필터 영역 (기존 유지) */}
      <div className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex w-full md:w-auto gap-2">
            {/* ... 기존 검색 필터 UI 유지 ... */}
            <select className="border rounded px-3 py-2 text-base" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
            <option value="name">이름</option>
            <option value="email">이메일</option>
            <option value="message">문의내용</option>
            </select>
            <div className="flex-1 md:w-80">
            <input type="text" placeholder="검색어를 입력하세요" className="w-full border rounded px-3 py-2 text-base" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="border rounded px-3 py-2 text-base" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="대기중">대기중</option>
            <option value="완료">완료</option>
            </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-lg font-bold text-gray-600">총 {filteredContacts.length}개의 문의</div>
      </div>

      {/* 테이블 영역 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full bg-white shadow-md rounded-lg overflow-hidden text-sm lg:text-base font-medium">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">번호</th>
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">문의 내용</th>
              <th className="px-4 py-3 text-left">답변 여부</th>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedContacts.map((contact, index) => (
              <tr key={contact._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{(currentPage - 1) * pageSize + index + 1}</td>
                <td className="px-4 py-3">{contact.name}</td>
                <td className="px-4 py-3 truncate max-w-xs" title={contact.message}>{contact.message}</td>
                <td className="px-4 py-3">
                    {contact.reply ? <span className="text-blue-600 font-bold">답변완료</span> : <span className="text-gray-400">미답변</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${contact.status === "대기중" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                    {contact.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center space-x-2">
                    <button onClick={() => openReplyModal(contact)} className="px-3 py-1.5 bg-indigo-500 text-white rounded hover:bg-indigo-600 text-sm">
                      답변하기
                    </button>
                    <button onClick={() => openStatusModal(contact)} className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
                      상태
                    </button>
                    <button onClick={() => handleDelete(contact._id)} className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- 답변 작성 모달 --- */}
      {isReplyModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                <h2 className="text-xl font-bold mb-4">문의 답변 작성</h2>
                <div className="mb-4 p-3 bg-gray-50 rounded border">
                    <p className="text-sm text-gray-500 mb-1">문의 내용 ({selectedContact.name}):</p>
                    <p className="text-gray-800">{selectedContact.message}</p>
                </div>
                <textarea 
                    className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    placeholder="답변 내용을 입력하세요..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                ></textarea>
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setIsReplyModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">취소</button>
                    <button onClick={handleReplySubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">답변 등록</button>
                </div>
            </div>
        </div>
      )}

      {/* --- 상태 수정 모달 (기존) --- */}
      {isStatusModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">문의 상태 수정</h2>
            <div className="mb-4 space-y-2">
                <button onClick={() => handleStatusUpdate('대기중')} className="w-full text-left px-4 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">대기중</button>
                <button onClick={() => handleStatusUpdate('진행중')} className="w-full text-left px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">진행중</button>
                <button onClick={() => handleStatusUpdate('완료')} className="w-full text-left px-4 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200">완료</button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContacts;
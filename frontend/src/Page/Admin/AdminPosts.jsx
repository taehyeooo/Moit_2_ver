import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const AdminPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("title");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        // ❗ API 경로를 백엔드(index.js)와 일치시킵니다.
        const response = await axios.get("http://localhost:3000/api/posts", {
          withCredentials: true,
        });
        setPosts(response.data);
      } catch (error) {
        console.error("게시글 가져오기 실패:", error);
        Swal.fire("오류", "게시글을 불러오는 중 문제가 발생했습니다.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

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
        // ❗ 지적해주신 대로 API 경로를 '/api/posts/'로 올바르게 수정했습니다.
        await axios.delete(`http://localhost:3000/api/posts/${id}`, {
          withCredentials: true
        });
        setPosts(posts.filter(post => post._id !== id));
        Swal.fire('삭제완료!', '게시글이 성공적으로 삭제되었습니다.', 'success');
      } catch (error) {
        console.error('삭제 실패:', error);
        Swal.fire('오류 발생!', '삭제 중 문제가 발생했습니다.', 'error');
      }
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const value = (post[searchType] || '').toString().toLowerCase();
      return value.includes(searchTerm.toLowerCase());
    });
  }, [posts, searchTerm, searchType]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return <div className="text-center p-8">게시글을 불러오는 중...</div>;
  }

  return (
    <div className="p-4 mx-auto max-w-[1700px]">
      <div className="flex justify-between items-center mt-6 mb-4">
        <h1 className="text-4xl font-bold">게시글 관리</h1>
        <button
          onClick={() => navigate("/admin/posts/create")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-center"
        >
          추가하기
        </button>
      </div>

      <div className="mb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex w-full md:w-auto gap-2">
          <select 
            className="border rounded px-3 py-2 text-base"
            value={searchType}
            onChange={e => setSearchType(e.target.value)}
          >
            <option value="title">제목</option>
            <option value="content">글 내용</option>
          </select>
          <div className="flex-1 md:w-80">
            <input
              type="text"
              placeholder="검색어를 입력하세요"
              className="w-full border rounded px-3 py-2 text-base"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-lg font-bold text-gray-600">총 {filteredPosts.length}개의 게시물</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow-md rounded-lg overflow-hidden text-sm lg:text-base font-medium">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left w-[5%]">번호</th>
              <th className="px-4 py-3 text-left w-[25%]">제목</th>
              <th className="px-4 py-3 text-left w-[10%]">파일</th>
              <th className="px-4 py-3 text-left w-[15%]">작성일</th>
              <th className="px-4 py-3 text-left w-[15%]">수정일</th>
              <th className="px-4 py-3 text-left w-[8%]">조회수</th>
              <th className="px-4 py-3 text-center w-[12%]">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedPosts.map((post) => (
              <tr key={post._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{post.number}</td>
                <td className="px-4 py-3 truncate" title={post.title}>{post.title}</td>
                <td className="px-4 py-3 text-center">
                  {post.fileUrl && post.fileUrl.length > 0 ? (
                    post.fileUrl.map((url, index) => (
                      <a 
                        key={index}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline mr-2"
                      >
                        파일{index + 1}
                      </a>
                    ))
                  ) : (
                    "없음"
                  )}
                </td>
                <td className="px-4 py-3">{new Date(post.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{new Date(post.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3">{post.views}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center space-x-2">
                    <button onClick={() => navigate(`/admin/posts/edit/${post._id}`)} className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                      수정
                    </button>
                    <button onClick={() => handleDelete(post._id)} className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm">
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedPosts.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg shadow mt-2">
             <p className="text-xl font-bold text-gray-500">검색 결과가 없습니다.</p> 
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center space-x-2 text-base font-medium">
        <button
          className="px-3 py-1 rounded border bg-white disabled:opacity-50"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          이전
        </button>
        <span className="px-3 py-1 flex items-center">{currentPage} / {totalPages}</span>
        <button
          className="px-3 py-1 rounded border bg-white disabled:opacity-50"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          다음
        </button>
      </div>
    </div>
  );
};

export default AdminPosts;


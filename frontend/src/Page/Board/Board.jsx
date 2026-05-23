import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // 👈 useNavigate import

const Board = () => {
  const [posts, setPosts] = useState([]); // 👈 실제 데이터를 저장할 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const navigate = useNavigate(); // 👈 페이지 이동을 위한 함수

  // 👈 백엔드에서 데이터를 불러오는 기능 추가
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await axios.get("/api/post");
        setPosts(response.data.posts || []);
      } catch (error) {
        console.error("게시글을 불러오는 중 오류 발생:", error);
      }
    };
    fetchPosts();
  }, []);

  const indexOfLastPost = currentPage * itemsPerPage;
  const indexOfFirstPost = indexOfLastPost - itemsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(posts.length / itemsPerPage);

  const handleRowClick = (id) => {
    navigate(`/post/${id}`); // 👈 클릭 시 상세 페이지로 이동
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto py-32 md:py-32">
      <h1 className="text-4xl md:text-5xl font-bold mb-6 md:mb-8 text-center">
        업무 게시판
      </h1>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-[8%]">
                번호
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-auto">
                제목
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-[15%]">
                작성일
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-[8%]">
                조회수
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentPosts.map((post) => (
              // 👈 각 행에 onClick 이벤트 추가
              <tr 
                key={post._id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleRowClick(post._id)}
              >
                <td className="px-6 py-4 whitespace-nowrap">{post.number}</td>
                <td className="px-6 py-4 whitespace-nowrap">{post.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(post.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{post.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 UI (선택사항) */}
      <div className="mt-4 flex justify-center">
        <nav>
          <ul className="inline-flex items-center -space-x-px">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <li key={page}>
                <button
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 leading-tight border ${currentPage === page ? 'bg-blue-50 text-blue-600 border-blue-300' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'}`}
                >
                  {page}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default Board;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaQ, FaA } from "react-icons/fa6";

const QnABoard = () => {
    const [qnaList, setQnaList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState(null); // 아코디언 열림 상태 관리

    useEffect(() => {
        const fetchQnA = async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/contact/qna');
                setQnaList(response.data);
            } catch (error) {
                console.error("QnA 로딩 실패:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchQnA();
    }, []);

    const toggleAccordion = (id) => {
        setOpenId(openId === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-32">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Q&A 게시판</h1>
                    <p className="text-gray-600">자주 묻는 질문들과 답변을 확인해보세요.</p>
                </div>

                {loading ? (
                    <div className="text-center py-10">로딩 중...</div>
                ) : qnaList.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-lg shadow text-gray-500">
                        아직 등록된 Q&A가 없습니다.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {qnaList.map((item) => (
                            <div key={item._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* 질문 영역 (클릭 시 답변 열림) */}
                                <div 
                                    onClick={() => toggleAccordion(item._id)}
                                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-4"
                                >
                                    <div className="mt-1 text-blue-600 text-xl"><FaQ /></div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-800">{item.message}</h3>
                                        <p className="text-sm text-gray-400 mt-1">
                                            작성자: {item.name[0]}** | {new Date(item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className="text-gray-400 text-2xl">
                                        {openId === item._id ? '−' : '+'}
                                    </span>
                                </div>

                                {/* 답변 영역 (아코디언) */}
                                {openId === item._id && (
                                    <div className="bg-blue-50 p-6 border-t border-gray-100 flex items-start gap-4 animate-fade-in">
                                        <div className="mt-1 text-red-500 text-xl"><FaA /></div>
                                        <div>
                                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{item.reply}</p>
                                            <p className="text-xs text-gray-400 mt-3">
                                                답변일: {new Date(item.repliedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QnABoard;
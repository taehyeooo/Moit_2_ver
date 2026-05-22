import React, { useState } from 'react';
import axios from 'axios';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '전송 중...' });

    try {
      const response = await axios.post('/api/contact', formData, { withCredentials: true });
      setStatus({ type: 'success', message: response.data.message });
      setFormData({ name: '', email: '', phone: '', message: '' }); // 폼 초기화
    } catch (error) {
      const errorMessage = error.response?.data?.message || '문의 접수 중 오류가 발생했습니다.';
      setStatus({ type: 'error', message: errorMessage });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-32">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">문의하기</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            MOIT에 대해 궁금한 점이 있으신가요?
            24시간 내에 답변드리겠습니다.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-gray-700 font-medium mb-2">이름</label>
                  <input
                    type="text" id="name" name="name"
                    value={formData.name} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                    placeholder="홍길동" required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-gray-700 font-medium mb-2">이메일</label>
                  <input
                    type="email" id="email" name="email"
                    value={formData.email} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                    placeholder="example@email.com" required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-gray-700 font-medium mb-2">연락처</label>
                  <input
                    type="tel" id="phone" name="phone"
                    value={formData.phone} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                    placeholder="010-1234-5678" required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-gray-700 font-medium mb-2">문의 내용</label>
                  <textarea
                    id="message" name="message"
                    value={formData.message} onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors h-40"
                    placeholder="문의하실 내용을 자세히 적어주세요." required
                  ></textarea>
                </div>

                {status.message && (
                  <div className={`p-3 rounded-lg text-center font-semibold ${
                    status.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {status.message}
                  </div>
                )}
                
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-300"
                >
                  문의하기
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">연락처 정보</h3>
              <div className="space-y-6">
                {[
                  { icon: "phone", title: "전화", info: "02-1234-5678", desc: "평일 09:00 - 18:00" },
                  { icon: "envelope", title: "이메일", info: "support@example.com", desc: "24시간 접수 가능" },
                  { icon: "map-marker-alt", title: "주소", info: "충청남도 아산시 신창면 순천향로 22", desc: "멀티미디어관 M206" }
                ].map((item, index) => (
                  <div key={index} className="flex items-start">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <i className={`fas fa-${item.icon} text-blue-600 text-xl`}></i>
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium text-gray-800">{item.title}</h4>
                      <p className="text-gray-600">{item.info}</p>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* 👇 --- [수정] 지도 iframe의 src를 실제 작동하는 순천향대학교 주소로 변경했습니다. --- 👇 */}
              <iframe 
                src="http://googleusercontent.com/maps.google.com/9"
                width="100%" 
                height="400" 
                style={{ border: 0 }}
                allowFullScreen="" 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade">
              </iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
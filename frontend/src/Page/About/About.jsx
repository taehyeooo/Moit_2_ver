import React from 'react';
import { motion } from 'framer-motion';

// 👈 1. 여기에 이미지 넣기
// assets 폴더에 넣은 이미지 파일을 여기서 import 합니다.
// 파일 이름을 바꾸셨다면 'moitmark1.jpg' 부분을 수정해 주세요.
import moitImage from '../../assets/moitmark1.png';


const About = () => {
  return (
    <div className="bg-white py-32 min-h-screen flex items-center">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          
          {/* 왼쪽 텍스트 영역 */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl font-bold text-slate-800 mb-6">
              취미를 통한 연결,
              <br />
              그 시작은 MOIT
            </h1>
            <p className="text-lg text-gray-500 mb-8 italic">
              일상의 설렘, 모잇에서.
            </p>
            <div className="text-gray-700 space-y-4 leading-relaxed">
              <p>
                누구나 쉽게 취미를 찾고, 사람을 만나고 함께 즐길 수 있는 공간을 만듭니다.
              </p>
              <p>
                우리는 모두 새로운 걸 시작하고 싶어 합니다.
                하지만 막상 취미를 찾으려면 정보는 부족하고, 함께할 사람은 더 없습니다.
              </p>
              <p>
                <span className="font-bold text-blue-600">MOIT</span>는 그런 고민에서 시작되었습니다.
              </p>
              <p>
                좋아하는 걸 시작하고, 같은 관심사를 가진 사람들과 함께하고,
                그 속에서 나만의 시간을 만들어가기를 바라는 마음에서요.
              </p>
              <p>
                그렇게 우리는 '취미로 모이는 사람들'이라는 철학을 담아,
                누구나 취미를 찾고, 사람을 만나고, 함께 즐길 수 있는 플랫폼을 만들기로 했습니다.
              </p>
            </div>
          </motion.div>

          {/* 오른쪽 이미지 영역 */}
          <motion.div 
            // 기존 파란 배경 대신 이미지가 잘 보이도록 배경을 없앴습니다.
            className="w-full flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* 👈 2. 여기에 이미지 표시 */}
            {/* 기존 SVG 그래픽 대신, 위에서 import한 이미지를 보여주는 img 태그로 교체했습니다. */}
            <img 
              src={moitImage} 
              alt="MOIT Brand Mark" 
              className="max-w-full h-auto rounded-2xl"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default About;
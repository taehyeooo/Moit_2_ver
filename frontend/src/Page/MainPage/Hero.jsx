import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
// 오른쪽 이미지 영역에 어울리는 이미지를 임시로 지정했습니다.
// 원하시는 다른 이미지로 교체해서 사용하세요. (예: import RunningImage from "../../assets/running.jpg";)
import HeroImage from "../../assets/home1Run.jpg"; 

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
  };

  return (
    <motion.div
      className="bg-black text-white min-h-screen flex items-center"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* 왼쪽 텍스트 영역 */}
          <motion.div className="text-center md:text-left" variants={itemVariants}>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
              취미를 찾고, 사람을 만나고,
              <br />
              함께 즐기세요 - <span className="text-blue-500">MOIT</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8">
              AI 기반 취미 추천 서비스와 모임을 만들고 함께 즐겨보세요.
            </p>
            <Link to="/about">
              <motion.button
                className="px-6 py-3 bg-transparent border border-white rounded-full hover:bg-blue-500 hover:border-blue-500 transition-colors duration-300 flex items-center gap-2 mx-auto md:mx-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                자세히 보기
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </motion.button>
            </Link>
          </motion.div>

          {/* 오른쪽 이미지 영역 */}
          <motion.div variants={itemVariants}>
            <img
              src={HeroImage}
              alt="Hobby activity"
              className="rounded-lg w-full h-auto object-cover"
              style={{ maxHeight: '70vh' }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Hero;
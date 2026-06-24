const express = require('express');
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const { verifyToken } = require('../utils/auth');

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간 (ms)

/**
 * ---------------------------------
 * POST /api/auth/signup - 회원가입
 * ---------------------------------
 */
router.post('/signup', async (req, res) => {
  try {
    // 1. 클라이언트에서 보낸 adminKey와 role을 받습니다.
    const { username, password, name, nickname, email, role, adminKey } = req.body;

    if (!username || !password || !name || !nickname || !email) {
      return res.status(400).json({ message: '모든 필수 정보를 입력해주세요.' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { nickname }, { email }] });
    if (existingUser) {
        if (existingUser.username === username) {
            return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
        }
        if (existingUser.nickname === nickname) {
            return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
        }
        if (existingUser.email === email) {
            return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
        }
    }

    // 2. 역할(role) 결정 로직 추가
    let userRole = 0; // 기본값: 일반 사용자 (0)

    if (role === 'admin') {
      // .env 파일에 설정된 ADMIN_KEY와 사용자가 입력한 키를 비교
      if (!process.env.ADMIN_KEY) {
         console.error("서버 설정 오류: .env 파일에 ADMIN_KEY가 없습니다.");
         return res.status(500).json({ message: '서버 설정 오류: 관리자 등록이 불가능합니다.' });
      }

      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ message: '관리자 등록 키가 올바르지 않습니다.' });
      }
      userRole = 1; // 관리자 권한 부여 (1)
    }

    // User 모델 인스턴스 생성 (role 포함)
    const user = new User({ 
        username, 
        password, 
        name, 
        nickname, 
        email,
        role: userRole 
    });
    
    await user.save();

    res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * ---------------------------------
 * POST /api/auth/login - 로그인
 * ---------------------------------
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '사용자 이름과 비밀번호를 모두 입력해주세요.' });
    }

    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (!user.isActive) {
        return res.status(403).json({ message: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      user.failedLoginAttempts += 1;
      user.lastLoginAttempt = new Date();

      if (user.failedLoginAttempts >= 5) {
        user.isActive = false;
        await user.save();
        return res.status(403).json({
          message: '비밀번호를 5회 이상 틀려 계정이 비활성화되었습니다.',
        });
      }

      await user.save();
      return res.status(401).json({
        message: '아이디 또는 비밀번호가 올바르지 않습니다.',
        remainingAttempts: 5 - user.failedLoginAttempts,
      });
    }
    
    // 로그인 성공 시 실패 횟수 초기화만 업데이트 (전체 문서 save() 불필요)
    await User.findByIdAndUpdate(user._id, {
        failedLoginAttempts: 0,
        lastLoginAttempt: new Date()
    });

    // 토큰에 role 정보도 포함하면 프론트엔드에서 활용하기 좋습니다 (선택사항)
    const token = jwt.sign(
      { userId: user._id, username: user.username, nickname: user.nickname, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_MAX_AGE_MS,
    });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * ----------------------------------------------------
 * POST /api/auth/verify-token - 토큰 검증 (상태 유지)
 * ----------------------------------------------------
 */
router.post("/verify-token", async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "토큰이 없습니다." });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // DB 조회 없이 JWT 디코딩 데이터로 응답 (매 새로고침 DB hit 제거)
      // 민감한 정보 변경(비밀번호, 권한 등)이 필요한 경우에만 DB 조회
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({ message: "인증 실패" });
      }
      res.json({ user });
    } catch (error) {
      res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
});

/**
 * ---------------------------------
 * POST /api/auth/logout - 로그아웃
 * ---------------------------------
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: '로그아웃되었습니다.' });
});

/**
 * ---------------------------------
 * GET /api/auth/mypage - 마이페이지 데이터 조회
 * ---------------------------------
 */
router.get('/mypage', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 두 쿼리가 독립적이므로 Promise.all로 병렬 조회 (순차 → 동시 실행)
    const [hostedMeetings, joinedMeetings] = await Promise.all([
      Meeting.find({ host: userId }).sort({ date: -1 }),
      Meeting.find({ participants: userId, host: { $ne: userId } }).sort({ date: -1 })
    ]);

    res.json({
      user,
      hostedMeetings,
      joinedMeetings
    });

  } catch (error) {
    console.error("마이페이지 데이터 조회 에러:", error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

/**
 * ---------------------------------
 * PUT /api/auth/profile - 프로필 정보 수정
 * ---------------------------------
 */
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { nickname, email, currentPassword, newPassword } = req.body;
        const userId = req.user.userId;

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        if (nickname && nickname !== user.nickname) {
            const existingNickname = await User.findOne({ nickname: nickname, _id: { $ne: userId } });
            if (existingNickname) {
                return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
            }
            user.nickname = nickname;
        }

        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email: email, _id: { $ne: userId } });
            if (existingEmail) {
                return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
            }
            user.email = email;
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: '현재 비밀번호를 입력해주세요.' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
            }
            user.password = newPassword; // pre-save 훅이 해싱 처리
        }

        await user.save();

        const updatedUser = user.toObject();
        delete updatedUser.password;

        res.json({ message: '프로필이 성공적으로 업데이트되었습니다.', user: updatedUser });
    } catch (error) {
        console.error("프로필 업데이트 에러:", error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/**
 * ---------------------------------------
 * DELETE /api/auth/delete/:userId - 계정 삭제 (본인 또는 관리자만)
 * ---------------------------------------
 */
router.delete('/delete/:userId', verifyToken, async (req, res) => {
    try {
      const requesterId = req.user.userId;
      const targetId = req.params.userId;

      // 본인 계정이 아니고 관리자도 아니면 거부
      if (requesterId !== targetId && req.user.role !== 1) {
        return res.status(403).json({ message: '본인 계정만 삭제할 수 있습니다.' });
      }

      const user = await User.findByIdAndDelete(targetId);
      if (!user) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      }
      res.json({ message: '사용자가 성공적으로 삭제되었습니다.' });
    } catch (error) {
      console.error("Delete User Error:", error);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

/**
 * -----------------------------------------------------------
 * DELETE /api/auth/delete-by-username/:username - 계정 삭제 (관리자 전용)
 * -----------------------------------------------------------
 */
router.delete('/delete-by-username/:username', verifyToken, async (req, res) => {
    try {
      if (req.user.role !== 1) {
        return res.status(403).json({ message: '관리자만 사용할 수 있습니다.' });
      }

      const { username } = req.params;
      const user = await User.findOneAndDelete({ username });
      if (!user) {
        return res.status(404).json({ message: '해당 사용자 이름을 가진 사용자를 찾을 수 없습니다.' });
      }
      res.json({ message: `사용자 '${username}'이(가) 성공적으로 삭제되었습니다.` });
    } catch (error) {
      console.error("Delete User by Username Error:", error);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router;
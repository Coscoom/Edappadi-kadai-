const fs = require('fs');
let html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');

const targetIndex = html.lastIndexOf('return {        text: replyText,        proposalData: proposalList,        phone: null, showTrack: false }; }');

if (targetIndex !== -1) {
  const before = html.substring(0, targetIndex);
  const goodTail = `return {
        text: replyText,
        proposalData: proposalList,
        phone: null,
        showTrack: false
      };
    }

    function getComprehensiveLocalOfflineResponse(userQuery, user, products, orders, settings) {
      const qLower = (userQuery || '').toLowerCase().trim();
      const currentLang = localStorage.getItem('ek_lang') || 'en';
      const hasTamilChar = /[\\u0B80-\\u0BFF]/.test(userQuery || '');
      const isTamil = (currentLang === 'ta' || hasTamilChar);
      const activeProducts = (products || []).filter(p => p && !p.isHidden);

      const offlineProposal = parseOfflineOrderProposal(userQuery, activeProducts, isTamil, "அண்ணே");
      if (offlineProposal) {
        return offlineProposal;
      }

      if (qLower.includes('points') || qLower.includes('loyalty') || qLower.includes('பாயிண்ட்ஸ்') || qLower.includes('மதிப்பெண்')) {
        const pts = user ? (user.loyaltyPoints || 0) : 0;
        const tierLabel = user ? (user.tier || 'bronze').toUpperCase() : 'BRONZE';
        return {
          text: isTamil 
            ? \`வணக்கம் அண்ணே! உங்களுடைய லாயல்டி கணக்கு விவரங்கள் இதோ:\\n\\n👤 பெயர்: **\${(user && user.name) || 'வாடிக்கையாளர்'}**\\n📞 போன்: **\${(user && user.phone) || '-'}**\\n🌟 லாயல்டி மதிப்பெண்: **\${pts} Points**\\n🎖️ உங்களது ரேங்க்: **\${tierLabel}**\\n\\nபுள்ளிகளைப் பயன்படுத்தி பில் தொகையில் தள்ளுபடி பெற்றுக்கொள்ளலாம் அண்ணே! 💎\`
            : \`Hello! Your Loyalty details:\\n\\nPoints: \${pts}\\nTier: \${tierLabel}\`,
          proposalData: null,
          phone: null,
          showTrack: false
        };
      }

      const defaultText = isTamil 
        ? 'வணக்கம் அண்ணே! எடப்பாடி கடையில் புதிய பிரஷ் சிக்கன், மட்டன், காடை மற்றும் வெஜிடபிள் லைவ் ஸ்டாக் தயாராக உள்ளது. என்ன வேணும்னு சொல்லுங்க அண்ணே, சட்டுனு ஆர்டர் எடுத்துக்குறேன்! 🛒🍗' 
        : 'Hello! Fresh Chicken, Mutton, Eggs & Vegetables are in stock at Edappadi Kadai. What would you like to order today?';

      return { 
        text: defaultText, 
        proposalData: null, 
        phone: null, 
        showTrack: false 
      };
    }
  </script>
</body>
</html>`;

  fs.writeFileSync('app/src/main/assets/index.html', before + goodTail);
  console.log('Successfully repaired index.html!');
} else {
  console.log('targetIndex not found!');
}

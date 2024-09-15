const toggleLanguageButton = document.getElementById('toggleLanguage');

toggleLanguageButton.addEventListener('click', () => {
    const isChinese = toggleLanguageButton.textContent === '中文';
    toggleLanguageButton.textContent = isChinese ? 'English' : '中文';

    document.querySelectorAll('[data-en]').forEach(el => {
        el.textContent = isChinese ? el.getAttribute('data-zh') : el.getAttribute('data-en');
    });

});



// 选择所有的导航链接
const navLinks = document.querySelectorAll('.nav ul li a');

// 定义每个部分的元素及其对应的导航链接
const sections = document.querySelectorAll('h2[id]');
const sectionMap = {};
sections.forEach(section => {
    const id = section.getAttribute('id');
    sectionMap[id] = document.querySelector(`.nav ul li a[href="#${id}"]`);
});

// 监听滚动事件
window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (pageYOffset >= sectionTop - 60) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});



document.addEventListener('keydown', function(event) {
    var nav = document.querySelector('.nav');
    if (event.key === 'h') {
        nav.style.display = 'none';
    } else if (event.key === 'j') {
        nav.style.display = 'block';
    }
});



document.addEventListener('keydown', function(event) {
    var nav = document.querySelector('.extra');
    if (event.key === 'a') {
        nav.style.display = 'none';
    } else if (event.key === 's') {
        nav.style.display = 'block';
    }
});

// 导航栏按钮点击后保持激活状态
document.querySelectorAll('.nav ul li a, .nav ul li button').forEach(button => {
    button.addEventListener('click', () => {
        // 移除所有按钮的激活状态
        document.querySelectorAll('.nav ul li a, .nav ul li button').forEach(btn => {
            btn.classList.remove('active');
        });
        // 添加当前按钮的激活状态
        button.classList.add('active');
    });
});



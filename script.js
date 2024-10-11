window.onload = function() {
    // وظيفة البحث
    document.getElementById('search-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const searchQuery = document.getElementById('search-input').value.toLowerCase();
        const articles = document.querySelectorAll('.article-card');
    
        articles.forEach(function(article) {
            const title = article.querySelector('h3').textContent.toLowerCase();
            const content = article.querySelector('p').textContent.toLowerCase();
    
            if (title.includes(searchQuery) || content.includes(searchQuery)) {
                article.style.display = 'block';
            } else {
                article.style.display = 'none';
            }
        });
    });

    // تحريك المقالات عند ظهورها
    const articles = document.querySelectorAll('.article-card');

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    articles.forEach(article => {
        observer.observe(article);
    });

    // عرض المقالات العشوائية في الكاروسيل
    const allArticles = document.querySelectorAll('#articles .article-card');
    const carouselContainer = document.querySelector('.carousel');
    let index = 0;

    function getRandomArticles() {
        const articlesArray = Array.from(allArticles);
        const shuffledArticles = articlesArray.sort(() => 0.5 - Math.random());
        const selectedArticles = shuffledArticles.slice(0, 3);

        carouselContainer.innerHTML = '';

        selectedArticles.forEach(article => {
            const clonedArticle = article.cloneNode(true);
            clonedArticle.classList.add('carousel-item');
            carouselContainer.appendChild(clonedArticle);
        });
    }

    getRandomArticles();

    function showNextSlide() {
        const totalItems = document.querySelectorAll('.carousel-item').length;
        index = (index + 1) % totalItems;
        const offset = -index * 33.33;
        carouselContainer.style.transform = `translateX(${offset}%)`;
    }

    function moveSlide(direction) {
        const totalItems = document.querySelectorAll('.carousel-item').length;
        if (direction === 'next') {
            index = (index + 1) % totalItems;
        } else if (direction === 'prev') {
            index = (index - 1 + totalItems) % totalItems;
        }
        const offset = -index * 33.33;
        carouselContainer.style.transform = `translateX(${offset}%)`;
    }

    const rightControl = document.querySelector('.carousel-control.right');
    const leftControl = document.querySelector('.carousel-control.left');

    if (rightControl && leftControl) {
        rightControl.addEventListener('click', () => moveSlide('next'));
        leftControl.addEventListener('click', () => moveSlide('prev'));
    }

    // تغيير المقالات تلقائيًا كل 10 ثوانٍ
    setInterval(showNextSlide, 10000);
};

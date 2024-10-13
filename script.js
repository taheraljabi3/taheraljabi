window.onload = function () {
    // وظيفة البحث
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const articles = document.querySelectorAll('.article-card');

    if (searchForm) {
        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const searchQuery = searchInput.value.toLowerCase();

            articles.forEach(function (article) {
                const title = article.querySelector('h3').textContent.toLowerCase();
                const content = article.querySelector('p').textContent.toLowerCase();

                if (title.includes(searchQuery) || content.includes(searchQuery)) {
                    article.style.display = 'block';
                } else {
                    article.style.display = 'none';
                }
            });
        });
    }

    // تحريك المقالات عند ظهورها باستخدام IntersectionObserver
    const observer = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );

    articles.forEach(article => {
        observer.observe(article);
    });

    // عرض المقالات العشوائية في الكاروسيل
    const allArticles = document.querySelectorAll('#articles .article-card');
    const carouselContainer = document.querySelector('.carousel');
    let index = 0;

    if (allArticles.length > 0 && carouselContainer) {
        getRandomArticles();
    } else {
        console.error('لم يتم العثور على مقالات أو الكاروسيل غير موجود.');
    }

    function getRandomArticles() {
        const articlesArray = Array.from(allArticles);
        const shuffledArticles = articlesArray.sort(() => 0.5 - Math.random());
        const selectedArticles = shuffledArticles.slice(0, 3);

        // تفريغ المحتوى الحالي
        carouselContainer.innerHTML = '';

        selectedArticles.forEach(article => {
            const clonedArticle = article.cloneNode(true);
            clonedArticle.classList.add('carousel-item');
            carouselContainer.appendChild(clonedArticle);
        });
    }

    function moveSlide(direction) {
        const totalItems = document.querySelectorAll('.carousel-item').length;
        if (totalItems === 0) {
            console.error('لا توجد عناصر في الكاروسيل.');
            return;
        }

        if (direction === 'next') {
            index = (index + 1) % totalItems;
        } else if (direction === 'prev') {
            index = (index - 1 + totalItems) % totalItems;
        }

        const offset = -index * 33.33;
        carouselContainer.style.transform = `translateX(${offset}%)`;
    }

    // ربط عناصر التحكم بالأزرار
    const rightControl = document.querySelector('.carousel-control.right');
    const leftControl = document.querySelector('.carousel-control.left');

    if (rightControl && leftControl) {
        rightControl.addEventListener('click', () => moveSlide('next'));
        leftControl.addEventListener('click', () => moveSlide('prev'));
    } else {
        console.error('لم يتم العثور على عناصر التحكم.');
    }

    // تغيير المقالات تلقائيًا كل 10 ثوانٍ
    setInterval(() => moveSlide('next'), 10000);
};

// عرض رسالة ترحيبية عند الضغط على زر
document.addEventListener("DOMContentLoaded", function() {
    const button = document.createElement("button");
    button.innerHTML = "اضغط هنا للترحيب";
    document.body.appendChild(button);

    button.addEventListener("click", function() {
        alert("مرحباً بك في موقعي!");
    });
});

function createElement(tag, attrs, content, children) {
    const e = document.createElement(tag);
    if (content)
        e.textContent = content;
    if (attrs) {
        for (const a in attrs) {
            e.setAttribute(a, attrs[a]);
        }
    }
    if (children) {
        if (children instanceof Array) children.forEach(c => e.appendChild(c));
        else e.appendChild(child)
    }
    return e;
}
const header = document.createElement('template');
header.innerHTML = `
    <header class="header">
        <h2>
            CMPS183: Homework 1
        </h2>
        <div class="pages">
            <span class="page">
                <a href="./index.html">Home</a>
            </span>
            <span class="page">
                <a href="./todo.html">Todo</a>
            </span>
            <span class="page">
                <a href="./todoForm.html">Todo Form</a>
            </span>
        </div>
    </header>`.trim();

const footer = document.createElement('template');
footer.innerHTML = `
<div class="footer">
        <div class="footer-container">
            <a href="#" class="footer-button">About Us</a> &nbsp;|&nbsp;
            <a href="#" class="footer-button">Contact</a>&nbsp;|&nbsp;
            <a href="#" class="footer-button">Privacy</a>&nbsp;|&nbsp;
            <a href="#" class="footer-button">Credits</a>
        </div>
    </div>
    `.trim();

const content = document.getElementsByClassName('content').item(0);
const sidebar = document.getElementsByClassName('sidebar').item(0);

const body = document.createElement('div');
body.classList.add('body');
body.appendChild(sidebar);
const contentWrapper = document.createElement('div');
contentWrapper.classList.add('content-wrapper');
contentWrapper.appendChild(content);
body.appendChild(contentWrapper);

header.content.firstChild.style.zIndex = 100;
document.body.appendChild(header.content)
document.body.appendChild(body);
document.body.appendChild(footer.content);


# GlideChat

GlideChat is a real-time, cross-device chat and social web application. It features real-time messaging using WebSockets, group chats, message posts, push notifications, and file/avatar uploads.

## Features

- **Real-Time Communication**: Built with Socket.io for instant message delivery.
- **Group Chats**: Create and join conversation rooms.
- **User Authentication**: Secure password hashing with Bcrypt.
- **File & Media Sharing**: Upload files, images, and videos in chats.
- **Custom Profiles**: Set custom user avatars.
- **Web Push Notifications**: Standard push notifications using VAPID keys.
- **Database Backend**: MongoDB integration via Mongoose for storing messages, users, and groups.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (running locally or a connection string)

### Installation

1. Clone or download this project.
2. Install the required Node packages:
   ```bash
   npm install
   ```

### Running the Application

1. Make sure your MongoDB service is running.
2. Run the application:
   ```bash
   npm start
   ```
3. Open your browser and navigate to `http://localhost:3000`.

---

## How to Upload to GitHub

Follow these steps to upload this project to your GitHub repository:

### 1. Set Your Git Identity (If not set)

Before making your first commit, tell Git who you are. Open your terminal in this folder and run:
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```
*(If you want this identity for all repositories on your computer, add the `--global` flag)*.

### 2. Make the Initial Commit

Run these commands to commit the prepared files:
```bash
git commit -m "Initial commit of GlideChat project"
```

### 3. Link to GitHub and Push

1. Go to [GitHub](https://github.com/) and create a new **public** or **private** repository (do not add a README, `.gitignore`, or License, as we have already created them).
2. Copy your repository's URL (e.g., `https://github.com/your-username/your-repo-name.git`).
3. Link your local project to the GitHub repository:
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   ```
4. Rename your main branch to `main` (optional but recommended):
   ```bash
   git branch -M main
   ```
5. Push the code to GitHub:
   ```bash
   git push -u origin main
   ```

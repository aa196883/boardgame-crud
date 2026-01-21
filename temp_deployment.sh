cd /home/ubuntu/boardgame-crud &&
git pull &&
sudo rsync -av --delete frontend/ /var/www/sites/leopoldine/boardgames/ &&
cd backend &&
./.venv/bin/pip install -r requirements.txt &&
sudo systemctl restart boardgame_crud
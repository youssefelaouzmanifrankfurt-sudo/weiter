import json
import os
from pathlib import Path

class ConfigManager:
    def __init__(self, config_file='config.json'):
        self.config_file = config_file
        self.config = self.load_config()
        
    def load_config(self):
        """Lädt die Konfiguration aus der JSON-Datei"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            # Stellt sicher, dass alle benötigten Verzeichnisse existieren
            self.ensure_directories(config)
            
            return config
        except FileNotFoundError:
            print(f"Konfigurationsdatei {self.config_file} nicht gefunden!")
            raise
        except json.JSONDecodeError:
            print(f"Fehler beim Lesen der Konfigurationsdatei {self.config_file}")
            raise
    
    def ensure_directories(self, config):
        """Stellt sicher, dass alle benötigten Verzeichnisse existieren"""
        directories = [
            config.get('database_path', '').rsplit('/', 1)[0],
            config.get('ghost_database_path', '').rsplit('/', 1)[0],
            config.get('image_storage_path', ''),
            config.get('temp_storage_path', ''),
            config.get('main_server_path', '')
        ]
        
        for directory in set(directories):  # set() entfernt Duplikate
            if directory:  # Nur wenn der Pfad nicht leer ist
                Path(directory).mkdir(parents=True, exist_ok=True)
    
    def get(self, key, default=None):
        """Gibt einen Konfigurationswert zurück"""
        return self.config.get(key, default)
    
    def update(self, key, value):
        """Aktualisiert einen Konfigurationswert"""
        self.config[key] = value
        
    def save(self):
        """Speichert die aktuelle Konfiguration in die Datei"""
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)

# Globale Instanz für einfache Zugriffe
config_manager = ConfigManager()

def get_config():
    """Gibt die globale Konfigurationsinstanz zurück"""
    return config_manager
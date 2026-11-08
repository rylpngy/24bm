import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

// Used only to provision credentials in an isolated acceptance database.
class AcceptanceHash {
  public static void main(String[] args) {
    System.out.print(new BCryptPasswordEncoder().encode("demo123456"));
  }
}

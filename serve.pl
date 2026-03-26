use strict;
use warnings;
use IO::Socket::INET;
use IO::Select;
use File::Basename;
use Cwd 'abs_path';

my $port = $ENV{PORT} || 4567;
my $root = dirname(abs_path($0));

my %mime = (
    '.html' => 'text/html; charset=utf-8',
    '.css'  => 'text/css; charset=utf-8',
    '.js'   => 'application/javascript; charset=utf-8',
    '.json' => 'application/json',
    '.png'  => 'image/png',
    '.jpg'  => 'image/jpeg',
    '.svg'  => 'image/svg+xml',
    '.ico'  => 'image/x-icon',
);

sub load_file {
    my ($path) = @_;
    open my $fh, '<:raw', $path or return undef;
    local $/;
    my $data = <$fh>;
    close $fh;
    return $data;
}

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Type      => SOCK_STREAM,
    Reuse     => 1,
    Listen    => 20,
) or die "Cannot create server: $!\n";

$| = 1;
print "Listening on http://localhost:$port\n";

my $select = IO::Select->new($server);

while (1) {
    my @ready = $select->can_read(0.1);
    for my $sock (@ready) {
        if ($sock == $server) {
            my $client = $server->accept();
            next unless $client;
            $client->autoflush(1);
            $select->add($client);
        } else {
            my $request = <$sock>;
            if (!$request) {
                $select->remove($sock);
                close $sock;
                next;
            }

            # Drain headers
            while (my $h = <$sock>) { last if $h =~ /^\r?\n$/; }

            my ($method, $path) = $request =~ /^(\w+)\s+(\S+)/;
            $path ||= '/';
            $path = '/index.html' if $path eq '/';
            $path =~ s/\?.*//;
            $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;

            my $file = $root . $path;
            $file =~ s|/|\\|g if $^O eq 'MSWin32';

            if (-f $file) {
                my $data = load_file($file);
                if (defined $data) {
                    my ($ext) = $file =~ /(\.\w+)$/;
                    my $ct = $mime{lc($ext || '')} || 'application/octet-stream';
                    my $len = length($data);
                    print $sock "HTTP/1.1 200 OK\r\nContent-Type: $ct\r\nContent-Length: $len\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
                    print $sock $data;
                }
            } else {
                my $body = "404 Not Found: $path";
                print $sock "HTTP/1.1 404 Not Found\r\nContent-Length: " . length($body) . "\r\nConnection: close\r\n\r\n$body";
            }

            $select->remove($sock);
            close $sock;
        }
    }
}
